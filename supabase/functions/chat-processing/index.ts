// supabase/functions/chat-processing/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import OpenAI from 'https://esm.sh/openai@4.0.0';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    // Get Supabase URL and anon key from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing environment variables");
      throw new Error('Missing Supabase environment variables');
    }

    // Parse the request body first to get the message
    let message, conversation_history;
    try {
      const body = await req.json();
      message = body.message;
      conversation_history = body.conversation_history;
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with the JWT token
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get user information with the provided JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error("Auth error:", authError || "No user found");
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          details: authError?.message || "No user found",
          message: "Authentication failed. Please sign in again."
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize OpenAI client
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('Missing OpenAI API key');
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });
    
    // Build conversation context for OpenAI
    let conversationContext = [];
    if (conversation_history && Array.isArray(conversation_history)) {
      conversationContext = conversation_history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    }
    
    // Build system prompt with explicit instructions
    const systemPrompt = `You are a helpful AI assistant for a family management app. 
    Help the user manage their calendar events and answer questions about their schedule.
    
    You should provide a natural, conversational response to the user's requests.
    
    You must NOT include any JSON or technical formatting in your human-readable response.
    
    When the user asks to create a calendar event, you should respond conversationally and
    then our system will automatically extract the event details.
    
    Example proper response:
    "I'll schedule your swim lessons weekly on Thursdays from 11:00 AM to 12:00 PM at Washington-Liberty High School until mid-June."
    
    Example INCORRECT response (never do this):
    "I'll schedule your swim lessons. Here are the details: **Title:** Swim Lessons, **Start Date:** 2025-03-09"
    
    NEVER include special formatting like "**Title:**" or JSON syntax in your visible response.
    Just speak naturally about the event in a conversational tone.
    
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
    
    // Analyze the message content to extract event information if needed
    let event = null;
    let intent = null;
    
    // If the message appears to be about creating an event
    if (/schedule|calendar|event|appointment|meeting|lesson|class/i.test(message)) {
      const dateMatch = /\b(tomorrow|today|\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b|\b\d{1,2}\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(message);
      const timeMatch = /\b(from|at|between)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)(?:\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))?/i.test(message);
      
      if (dateMatch || timeMatch || /next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(message)) {
        // It looks like an event creation request
        intent = 'create_event';
        
        // Extract event information
        let title = "";
        let location = "";
        let startDate = new Date();
        let startTime = "";
        let endTime = "";
        let isRecurring = /weekly|every|each|recur/i.test(message);
        let recurrencePattern = "";
        
        // Simple rule-based extraction (in production, you would use a more sophisticated NLP approach)
        // Extract title (taking the first noun phrase or activity mentioned)
        const titleMatch = message.match(/\b(?:schedule|add|create|plan|book)\s+([a-z\s]+?)(?:\s+(?:on|at|for|from|tomorrow|today|next))/i);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        } else {
          // Fallback title
          title = "Event";
        }
        
        // Extract location if present
        const locationMatch = message.match(/\bat\s+([A-Za-z0-9\s\-]+(?:School|Center|Building|Park|Place|Plaza|Street|Ave|Avenue|Road|Blvd|Boulevard|Drive|Lane))/i);
        if (locationMatch && locationMatch[1]) {
          location = locationMatch[1].trim();
        }
        
        // Extract time
        const timeRangeMatch = message.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))/i);
        if (timeRangeMatch) {
          startTime = timeRangeMatch[1].trim();
          endTime = timeRangeMatch[2].trim();
        } else {
          const singleTimeMatch = message.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))/i);
          if (singleTimeMatch) {
            startTime = singleTimeMatch[1].trim();
          }
        }
        
        // Extract date
        const tomorrowMatch = /\btomorrow\b/i.test(message);
        if (tomorrowMatch) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          startDate = tomorrow;
        }
        
        // Check for recurring pattern
        if (isRecurring) {
          if (/\bweekly\b/i.test(message)) {
            recurrencePattern = "Weekly";
          } else if (/\bevery\s+(\w+day)/i.test(message)) {
            const dayMatch = message.match(/\bevery\s+(\w+day)/i);
            if (dayMatch) {
              recurrencePattern = `Weekly on ${dayMatch[1]}`;
            }
          } else if (/\buntil\s+([a-z\s]+)/i.test(message)) {
            const untilMatch = message.match(/\buntil\s+([a-z\s]+)/i);
            if (untilMatch) {
              recurrencePattern = `Until ${untilMatch[1]}`;
            }
          }
        }
        
        // Format the extracted information into an event object
        event = {
          title: title,
          date: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
          start_time: startTime,
          end_time: endTime,
          location: location,
          is_recurring: isRecurring,
          recurrence_pattern: recurrencePattern
        };
      }
    } else if (/what'?s\s+(?:happening|scheduled|planned|on|up)/i.test(message) || /show\s+(?:me\s+)?(?:my\s+)?(?:calendar|schedule|events)/i.test(message)) {
      // It looks like a schedule query
      intent = 'query_schedule';
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
          events = data || [];
        }
      } catch (error) {
        console.error('Error processing schedule query:', error);
      }
    }

    return new Response(
      JSON.stringify({
        message: assistantResponse,
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
        details: error.message || String(error),
        message: "I'm sorry, I couldn't process your request right now. Please try again later."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});