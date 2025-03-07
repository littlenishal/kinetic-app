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
                
                // IMPORTANT CHANGE: Don't try to convert times to Date objects here
                // Instead, preserve the original time information from the LLM
                event = {
                  title: eventData.title,
                  date: eventData.date,  // Keep as string "YYYY-MM-DD"
                  start_time: eventData.start_time,  // Keep as string "HH:MM"
                  end_time: eventData.end_time,  // Keep as string "HH:MM" if exists
                  location: eventData.location,
                  is_recurring: eventData.is_recurring || false,
                  recurrence_pattern: eventData.recurrence_pattern,
                  
                  // Add original time strings to preserve LLM intent
                  original_start_time: eventData.start_time,
                  original_end_time: eventData.end_time
                };
                
                // We still need a date object for database storing, so create one
                // but keep it separate from what we'll send to the frontend
                try {
                  // Only create Date objects for internal use, not for display
                  if (eventData.date && eventData.start_time) {
                    const [year, month, day] = eventData.date.split('-').map(Number);
                    const [hours, minutes] = eventData.start_time.split(':').map(Number);
                    
                    const startDateObj = new Date(year, month - 1, day);
                    startDateObj.setHours(hours, minutes, 0, 0);
                    
                    // Store this separately for database operations
                    event.start_date_obj = startDateObj;
                    
                    // If end time exists, create end date object too
                    if (eventData.end_time) {
                      const [endHours, endMinutes] = eventData.end_time.split(':').map(Number);
                      const endDateObj = new Date(year, month - 1, day);
                      endDateObj.setHours(endHours, endMinutes, 0, 0);
                      
                      // Store separately for database operations
                      event.end_date_obj = endDateObj;
                    }
                  }
                } catch (dateError) {
                  console.error('Error creating date objects:', dateError);
                }
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
    // This will remove any stray braces that might be part of incomplete JSON objects
    let cleanResponse = assistantResponse
      // First remove complete JSON objects
      .replace(/{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g, '')
      // Then remove any stray closing braces that might be left
      .replace(/\s*\}\s*\}/g, '')
      .trim();

    // Make sure we have a valid response - if it's empty after cleaning, create a reasonable message
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