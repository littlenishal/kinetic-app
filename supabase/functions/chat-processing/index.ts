// Complete updated version of supabase/functions/chat-processing/index.ts

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

// This function helps properly convert dates without timezone issues
const createDateFromComponents = (dateStr, timeStr) => {
  try {
    // Parse the date components
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Create a base date (don't worry about timezone yet)
    const date = new Date(year, month - 1, day);
    
    // If time is provided, add it
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    }
    
    // Return the date object
    return date;
  } catch (error) {
    console.error('Error creating date:', error);
    return new Date(); // Fallback to current date
  }
};

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
    
    // Build improved system prompt with explicit instructions
    const systemPrompt = `You are a helpful AI assistant for a family management app. 
    Help the user manage their calendar events and answer questions about their schedule.
    
    First, generate a friendly, natural language response to the user's request. 
    DO NOT include any JSON in your visible response text.
    
    Then, if the user's message contains a request to create a calendar event, append a SEPARATE JSON object
    at the END of your response that contains the event details in this format:
    
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

    If the user is asking about their schedule, append this JSON at the END of your response:
    
    {
      "intent": "query_schedule",
      "time_period": "today/tomorrow/this weekend/etc"
    }

    If the message doesn't relate to calendar events, don't append any JSON.
    
    Remember: Your visible response should NEVER contain JSON. The JSON should be separate from your natural language response.
    
    Current date and time: ${new Date().toISOString()}`;

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
      // Look for JSON in the response - using a regex that matches the full JSON object
      const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
      const jsonMatches = assistantResponse.match(jsonRegex);
      
      if (jsonMatches && jsonMatches.length > 0) {
        // Try to parse each potential JSON match
        for (const jsonStr of jsonMatches) {
          try {
            const jsonData = JSON.parse(jsonStr);
            
            // Check if this is a valid event or schedule intent
            if (jsonData.intent === 'create_event' || jsonData.intent === 'query_schedule') {
              intent = jsonData.intent;
              
              // If it's a create_event intent, extract the event data
              if (intent === 'create_event' && jsonData.event) {
                const eventData = jsonData.event;
                
                // Format the date and time properly
                const dateStr = eventData.date;
                const startTimeStr = eventData.start_time;
                
                try {
                  // Create a JS Date object from the extracted date and time
                  // using our helper function that handles dates properly
                  const startDate = createDateFromComponents(dateStr, startTimeStr);
                  
                  // Handle end time if available
                  let endDate = null;
                  if (eventData.end_time) {
                    // Create end date based on same day as start
                    endDate = new Date(startDate);
                    const [endHours, endMinutes] = eventData.end_time.split(':').map(Number);
                    endDate.setHours(endHours, endMinutes, 0, 0);
                  }
                      
                  event = {
                    title: eventData.title,
                    start_time: startDate,
                    end_time: endDate,
                    location: eventData.location,
                    is_recurring: eventData.is_recurring || false,
                    recurrence_pattern: eventData.recurrence_pattern
                  };
                } catch (dateError) {
                  console.error('Error parsing date/time:', dateError);
                }
              }
            }
          } catch (parseError) {
            console.error('Error parsing JSON candidate:', parseError);
            // Continue to next JSON candidate
          }
        }
      }
    } catch (error) {
      console.error('Error processing JSON in response:', error);
      // Continue with the response even if JSON processing fails
    }
    
    // Clean response text by removing JSON
    cleanResponse = assistantResponse.replace(/{[^]*?}/g, '').trim();
    
    // Make sure we have a valid response - if it's empty after cleaning, create a reasonable message
    if (!cleanResponse || cleanResponse.length < 5) {
      if (event) {
        cleanResponse = `I'll add "${event.title}" to your calendar for ${event.start_time.toLocaleDateString()} at ${event.start_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      } else if (intent === 'query_schedule') {
        cleanResponse = "I'll check your schedule and let you know what's coming up.";
      } else {
        cleanResponse = "I understand your request. Is there anything else you'd like me to help with?";
      }
    }
    
    // If it's a schedule query, fetch relevant events
    let events = [];
    if (intent === 'query_schedule') {
      try {
        // Get today's date
        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        
        // Default to showing a week of events
        let endDate = new Date(today);
        endDate.setDate(today.getDate() + 7);
        
        // Fetch events for the relevant time period
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .gte('start_time', todayStart.toISOString())
          .lte('start_time', endDate.toISOString())
          .order('start_time');
          
        if (error) {
          console.error('Error fetching events:', error);
        } else {
          events = data;
        }
      } catch (error) {
        console.error('Error processing request:', error);
      }
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