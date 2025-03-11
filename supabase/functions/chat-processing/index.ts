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
    let message, conversation_history, search_title;
    try {
      const body = await req.json();
      message = body.message;
      conversation_history = body.conversation_history;
      search_title = body.search_title; // Get potential search title from client
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
    
    When the user asks to modify an existing event, respond in a way that clearly indicates 
    you're updating an existing event, not creating a new one.
    
    Example proper response for event creation:
    "I'll schedule your swim lessons weekly on Thursdays from 11:00 AM to 12:00 PM at Washington-Liberty High School until mid-June."
    
    Example proper response for event update:
    "I've updated Maya's swim lessons to March 18th from 2:00 PM to 3:00 PM."
    
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
    let existingEventId = null;

    // Check if this is an update to an existing event
    const updateMatches = /update|change|move|reschedule|edit|modify|postpone|shift/i.test(message);
    
    // Check for specific event mention patterns
    const eventNameMatches = message.match(/(?:update|change|move|reschedule|edit|modify)(?:\s+the)?(?:\s+event)?(?:\s+for)?\s+["']?([^"']+?)["']?\s+(?:to|from|at|on)/i);
    
    // Look for possessive forms like "Maya's swim lessons"
    const possessiveMatch = message.match(/(?:update|change|move|reschedule|edit|modify)(?:\s+the)?(?:\s+)(?:([a-z']+(?:'s))\s+([a-z\s]+))/i);
    
    // Look for direct mentions like "swim lessons"
    const directMatch = message.match(/(?:update|change|move|reschedule|edit|modify)\s+(?:the\s+)?([a-z\s]+)/i);
    
    let eventTitle = null;
    if (eventNameMatches) {
      eventTitle = eventNameMatches[1].trim();
    } else if (possessiveMatch) {
      eventTitle = `${possessiveMatch[1]} ${possessiveMatch[2]}`.trim();
    } else if (directMatch) {
      eventTitle = directMatch[1].trim();
    } else if (search_title) {
      // Use the search title provided by the client if available
      eventTitle = search_title;
    }

    // Special case: User explicitly says they need to update an event without details
    if (/\bneed\s+to\s+update\b/i.test(message) || /\bupdate\s+[a-z]+['']s\b/i.test(message)) {
      const specificEventMatch = message.match(/\b(?:need\s+to\s+update|update)\s+([a-z]+(?:'s)?\s+[a-z]+(?:\s+[a-z]+)*)\b/i);
      
      if (specificEventMatch) {
        const searchTitle = specificEventMatch[1].trim();
        intent = 'update_event';
        
        console.log(`Detected update intent for: "${searchTitle}"`);
        eventTitle = searchTitle;
      }
    }
    
    // Handle direct edit commands
    if (/\b(?:open|show|display|start|launch|bring up)(?:\s+the)?(?:\s+edit(?:or|ing)?)?(?:\s+(?:flow|form|interface))?\s+for\b/i.test(message)) {
      const editCommandMatch = message.match(/\b(?:open|show|display|start|launch|bring up)(?:\s+the)?(?:\s+edit(?:or|ing)?)?(?:\s+(?:flow|form|interface))?\s+for\s+([^,.]+)/i);
      
      if (editCommandMatch) {
        const searchTitle = editCommandMatch[1].trim();
        intent = 'edit_event'; // Use a specific intent for explicit edit requests
        eventTitle = searchTitle;
        
        console.log(`Detected direct edit command for: "${searchTitle}"`);
      }
    }

    // If message appears to be about updating an event
    if (updateMatches && eventTitle) {
      intent = 'update_event';
      console.log(`Detected update intent for event: "${eventTitle}"`);
      
      // Look for existing events with matching title using multiple approaches
      try {
        // First try exact match
        let queryResult = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .eq('title', eventTitle)
          .order('start_time', { ascending: false })
          .limit(1);
          
        // If no exact match, try case-insensitive exact match
        if (queryResult.error || queryResult.data.length === 0) {
          queryResult = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .ilike('title', eventTitle)
            .order('start_time', { ascending: false })
            .limit(1);
        }
        
        // If still no match, try partial match
        if (queryResult.error || queryResult.data.length === 0) {
          queryResult = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .ilike('title', `%${eventTitle}%`)
            .order('start_time', { ascending: false })
            .limit(1);
        }
        
        // Additional search for specific keywords that might be in the title
        if (queryResult.error || queryResult.data.length === 0) {
          // Try to extract key words from the event title
          const keyWords = eventTitle.split(/\s+/).filter(word => word.length > 3);
          
          if (keyWords.length > 0) {
            // Try each keyword
            for (const keyword of keyWords) {
              queryResult = await supabase
                .from('events')
                .select('*')
                .eq('user_id', user.id)
                .ilike('title', `%${keyword}%`)
                .order('start_time', { ascending: false })
                .limit(1);
                
              if (!queryResult.error && queryResult.data && queryResult.data.length > 0) {
                break; // Stop if we found a match
              }
            }
          }
        }
        
        // Check for "lessons" specifically if we're still not finding anything
        if ((queryResult.error || queryResult.data.length === 0) && 
            (message.toLowerCase().includes('lesson') || message.toLowerCase().includes('class'))) {
          queryResult = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .ilike('title', '%lesson%')
            .order('start_time', { ascending: false })
            .limit(1);
        }
        
        if (!queryResult.error && queryResult.data && queryResult.data.length > 0) {
          existingEventId = queryResult.data[0].id;
          console.log(`Found existing event with ID ${existingEventId} and title "${queryResult.data[0].title}"`);
          
          // If there's a partial match but not our exact title, also create an event object
          // to send back with the corrected title
          event = {
            id: existingEventId,
            title: queryResult.data[0].title,
            // We'll let the client fill in the rest of the details from the database
          };
        } else {
          console.log('No matching events found');
        }
      } catch (error) {
        console.error('Error searching for existing events:', error);
      }
    }
    
    // If the message appears to be about creating an event
    else if (/schedule|calendar|event|appointment|meeting|lesson|class/i.test(message)) {
      const dateMatch = /\b(tomorrow|today|\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b|\b\d{1,2}\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(message);
      const timeMatch = /\b(from|at|between)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)(?:\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))?/i.test(message);
      const dayNameMatch = /\b(?:next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(message);
      
      if (dateMatch || timeMatch || dayNameMatch) {
        // It looks like an event creation request
        intent = 'create_event';
        
        // Extract event information
        let title = "";
        let location = "";
        let dateReference = "";
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
        
        // Extract date reference or day name
        const tomorrowMatch = /\btomorrow\b/i.test(message);
        const todayMatch = /\btoday\b/i.test(message);
        
        if (tomorrowMatch) {
          dateReference = "tomorrow";
        } else if (todayMatch) {
          dateReference = "today";
        } else {
          // Try to extract day names
          const dayNameRegex = /\b(?:next\s+)?(\bsunday\b|\bmonday\b|\btuesday\b|\bwednesday\b|\bthursday\b|\bfriday\b|\bsaturday\b)/i;
          const dayNameMatch = message.match(dayNameRegex);
          if (dayNameMatch && dayNameMatch[1]) {
            dateReference = dayNameMatch[1].toLowerCase();
          }
          
          // Try to extract specific dates like March 18
          const specificDateMatch = message.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i);
          if (specificDateMatch) {
            const month = specificDateMatch[1];
            const day = specificDateMatch[2];
            const year = specificDateMatch[3] || new Date().getFullYear().toString();
            dateReference = `${month} ${day}, ${year}`;
          }
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
          id: existingEventId, // Include the existing event ID if found
          title: title,
          date: dateReference || "tomorrow", // Send the date reference instead of a formatted date
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
        events: events,
        existing_event_id: existingEventId
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