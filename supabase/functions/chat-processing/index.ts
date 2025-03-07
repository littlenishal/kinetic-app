// Fixed version of supabase/functions/chat-processing/index.ts

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
    
    // Extract the token from the Authorization header
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
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
    
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const assistantResponse = completion.choices[0].message.content || '';
    
    // Parse potential JSON from the assistant's response
    let event = null;
    let intent = null;
    
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
                event = jsonData.event;
              }
            }
          } catch (parseError) {
            console.error('Error parsing JSON candidate:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('Error processing JSON in response:', error);
    }
    
    // Clean response text by removing JSON
    let cleanResponse = assistantResponse
      // First remove complete JSON objects
      .replace(/{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g, '')
      // Then remove any stray closing braces that might be left
      .replace(/\s*\}\s*\}/g, '')
      .trim();

    // Make sure we have a valid response
    if (!cleanResponse || cleanResponse.length < 5) {
      if (event) {
        cleanResponse = `I'll add "${event.title}" to your calendar.`;
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
          .eq('user_id', user.id)
          .gte('start_time', todayStart.toISOString())
          .lte('start_time', endDate.toISOString())
          .order('start_time');
          
        if (error) {
          console.error('Error fetching events:', error);
        } else {
          events = data;
        }
      } catch (error) {
        console.error('Error processing schedule query:', error);
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
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.toString(),
        message: "I'm sorry, I couldn't process your request right now. Please try again later."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});