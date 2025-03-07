// supabase/functions/email-processing/index.ts

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

interface EmailData {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: any[];
}

interface Event {
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  is_recurring?: boolean;
  recurrence_pattern?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    // Validate incoming email data
    if (!email || !email.to || !email.from || !email.subject) {
      return new Response(
        JSON.stringify({ error: 'Invalid email data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract user email from the recipient
    // Format is expected to be username+calendar@yourdomain.com
    const emailRegex = /^([^+]+)\+calendar@(.+)$/;
    const match = email.to.match(emailRegex);
    
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Invalid recipient format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up user by email
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', match[1] + '@' + match[2])
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add to email processing queue
    const { data: queueData, error: queueError } = await supabase
      .from('email_queue')
      .insert({
        user_id: userData.id,
        email_data: email,
        status: 'pending'
      })
      .select()
      .single();

    if (queueError) {
      throw queueError;
    }

    // Process email with OpenAI
    const systemPrompt = `You are an AI assistant that extracts calendar events from emails.
    Extract any event details from the provided email, including:
    - Event title (required)
    - Date (required, in YYYY-MM-DD format)
    - Start time (required, in 24-hour HH:MM format)
    - End time (if available, in 24-hour HH:MM format)
    - Location (if available)
    - Description (if available)
    - Is this a recurring event? (boolean)
    - Recurrence details (if it's recurring)

    Return the extracted information in JSON format:
    {
      "events": [
        {
          "title": "Event Title",
          "date": "YYYY-MM-DD",
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "location": "Location",
          "description": "Description",
          "is_recurring": false,
          "recurrence_pattern": null
        }
      ]
    }

    If multiple events are found, include them all in the events array.
    If no event is found, return { "events": [] }
    
    IMPORTANT: Always return valid, complete JSON. Never omit mandatory fields like title, date, or start_time.`;

    const emailContent = `
      From: ${email.from}
      Subject: ${email.subject}
      
      ${email.text}
    `;

    const completion = await openai.chat.completions.create({
      model: Deno.env.get('OPENAI_MODEL') || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: emailContent }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const assistantResponse = completion.choices[0].message.content;
    
    // Parse events from response
    let events = [];
    
    try {
      const jsonData = JSON.parse(assistantResponse);
      events = jsonData.events || [];
    } catch (error) {
      console.error('Error parsing events from OpenAI response:', error);
      
      // Attempt to extract JSON using regex as fallback
      try {
        const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
        const jsonMatches = assistantResponse.match(jsonRegex);
        
        if (jsonMatches && jsonMatches.length > 0) {
          for (const match of jsonMatches) {
            try {
              const data = JSON.parse(match);
              if (data.events) {
                events = data.events;
                break;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      } catch {
        console.error('Regex extraction fallback also failed');
      }
    }

    // Process extracted events
    const processedEvents = [];
    
    for (const eventData of events) {
      // Validate mandatory fields
      if (!eventData.title || !eventData.date || !eventData.start_time) {
        console.warn('Skipping event with missing required fields:', eventData);
        continue;
      }
      
      try {
        // Store original time strings to preserve user intent (like in chat-processing)
        const originalStartTime = eventData.start_time;
        const originalEndTime = eventData.end_time;
        
        // Prepare date objects for database (using similar approach to chat-processing)
        const [year, month, day] = eventData.date.split('-').map(Number);
        const [startHours, startMinutes] = eventData.start_time.split(':').map(Number);
        
        // Create a start date in the user's timezone context
        const startDate = new Date(year, month - 1, day);
        startDate.setHours(startHours, startMinutes, 0, 0);
        
        // Create end date if end time is provided
        let endDate = null;
        if (eventData.end_time) {
          const [endHours, endMinutes] = eventData.end_time.split(':').map(Number);
          endDate = new Date(year, month - 1, day);
          endDate.setHours(endHours, endMinutes, 0, 0);
        }
        
        // Insert event into database
        const { data: newEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            user_id: userData.id,
            title: eventData.title,
            description: eventData.description,
            start_time: startDate.toISOString(),
            end_time: endDate ? endDate.toISOString() : null,
            location: eventData.location,
            is_recurring: eventData.is_recurring || false,
            recurrence_pattern: eventData.recurrence_pattern ? JSON.stringify(eventData.recurrence_pattern) : null,
            source: 'email'
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('Error inserting event:', insertError);
          continue;
        }
        
        // Add successful event to processed list
        processedEvents.push({
          ...newEvent,
          original_start_time: originalStartTime,
          original_end_time: originalEndTime
        });
      } catch (error) {
        console.error('Error processing event:', error, eventData);
      }
    }

    // Update email processing status
    await supabase
      .from('email_queue')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', queueData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email processed successfully. Created ${processedEvents.length} events.`,
        events_created: processedEvents.length,
        events: processedEvents
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing email:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});