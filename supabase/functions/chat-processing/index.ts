// Supabase Edge Function for handling chat messages
// This will parse user intents and extract calendar event information

import { createClient } from 'supabase';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define interface for event data
interface Event {
  title: string;
  description?: string;
  start_time: Date;
  end_time: Date | null;
  location?: string;
  is_recurring?: boolean;
  recurrence_pattern?: any;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, conversation_history } = await req.json();
    const userId = req.headers.get('authorization')?.split(' ')[1];

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Build conversation context for OpenAI
    const conversationContext = conversation_history.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Build system prompt
    const systemPrompt = `You are a helpful AI assistant for a family management app. 
    Help the user manage their calendar events and answer questions about their schedule.
    
    If the user's message contains a request to create a calendar event, extract the following information:
    - Event title
    - Date
    - Start time
    - End time (if provided)
    - Location (if provided)
    - Recurrence (if it's a recurring event)

    Format this as structured JSON within your response like this:
    {
      "intent": "create_event",
      "event": {
        "title": "Event title",
        "date": "YYYY-MM-DD",
        "start_time": "HH:MM",
        "end_time": "HH:MM",
        "location": "Location",
        "is_recurring": boolean,
        "recurrence_pattern": { details if recurring }
      }
    }

    If the user is asking about their schedule, respond with:
    {
      "intent": "query_schedule",
      "time_period": "today/tomorrow/this weekend/etc"
    }

    If the message doesn't relate to calendar events, simply respond normally without structured data.`;

    // Get OpenAI model from environment variable or use default
    const openAiModel = Deno.env.get('OPENAI_MODEL') || "gpt-4o-mini";
    
    // Call OpenAI to process the message
    const completion = await openai.chat.completions.create({
      model: openAiModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationContext,
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantResponse = completion.choices[0].message.content;
    
    // Parse potential JSON from the assistant's response
    let event = null;
    let intent = null;
    let cleanResponse = assistantResponse;
    
    try {
      // Look for JSON in the response
      const jsonMatch = assistantResponse.match(/{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        intent = jsonData.intent;
        
        // If it's a create_event intent, extract the event data
        if (intent === 'create_event' && jsonData.event) {
          const eventData = jsonData.event;
          
          // Format the date and time properly
          const dateStr = eventData.date;
          const startTimeStr = eventData.start_time;
          
          // Create a JS Date object from the extracted date and time
          const [year, month, day] = dateStr.split('-').map(Number);
          const [hours, minutes] = startTimeStr.split(':').map(Number);
          
          const startDate = new Date(year, month - 1, day, hours, minutes);
          
          let endDate = null;
          if (eventData.end_time) {
            const [endHours, endMinutes] = eventData.end_time.split(':').map(Number);
            endDate = new Date(year, month - 1, day, endHours, endMinutes);
          }
          
          event = {
            title: eventData.title,
            start_time: startDate,
            end_time: endDate,
            location: eventData.location,
            is_recurring: eventData.is_recurring || false,
            recurrence_pattern: eventData.recurrence_pattern
          };
        }
      }
    } catch (error) {
      console.error('Error parsing JSON from response:', error);
      // Continue with the response even if JSON parsing fails
    }
    
    // If it's a schedule query, fetch relevant events
    let events = [];
    if (intent === 'query_schedule') {
      // This would be expanded to handle different time periods in a real implementation
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time');
        
      if (error) {
        console.error('Error fetching events:', error);
      } else {
        events = data;
      }
    }
    
    // Clean response text by removing JSON if present
    if (intent) {
      // Remove JSON from response to show clean text to user
      cleanResponse = assistantResponse.replace(/{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/, '').trim();
    }

    return new Response(
      JSON.stringify({
        message: cleanResponse,
        intent: intent,
        event: event,
        events: events
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});