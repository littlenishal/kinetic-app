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

// OneSignal webhook payload interface
interface OneSignalEmailPayload {
  notification_id: string;
  email_id: string;
  email_address: string;
  subject: string;
  from_address: string;
  from_name: string;
  content_text: string;
  content_html?: string;
  attachments?: any[];
  timestamp: number;
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

/**
 * Verify OneSignal webhook signature
 * This is a simplified example - implement according to OneSignal's documentation
 */
const verifyOneSignalWebhook = (signature: string | null, payload: any): boolean => {
  if (!signature) {
    return false;
  }
  
  // Get webhook secret from environment
  const webhookSecret = Deno.env.get('ONESIGNAL_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.warn('OneSignal webhook secret not configured');
    return false;
  }
  
  try {
    // In a real implementation, you would:
    // 1. Create an HMAC-SHA256 hash of the payload using the webhook secret
    // 2. Compare it with the provided signature
    // 3. Return true only if they match
    
    // For development, you may want to bypass verification
    const bypassVerification = Deno.env.get('BYPASS_WEBHOOK_VERIFICATION') === 'true';
    if (bypassVerification) {
      console.warn('Bypassing webhook signature verification (not recommended for production)');
      return true;
    }
    
    // TODO: Implement proper signature verification based on OneSignal's documentation
    return true;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = performance.now();
  let userId = null;
  let notificationId = null;

  try {
    // Handle both direct and OneSignal webhook payloads
    const body = await req.json();
    let emailData;
    
    // Check webhook signature if available for security
    const webhookSignature = req.headers.get('x-webhook-signature');
    
    // Check if this is a OneSignal webhook payload
    if (body.notification_id && body.email_id) {
      // This is a OneSignal webhook
      const oneSignalPayload = body as OneSignalEmailPayload;
      notificationId = oneSignalPayload.notification_id;
      
      // Verify webhook signature
      if (!verifyOneSignalWebhook(webhookSignature, body)) {
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Look up user by email ID or directly by email
      try {
        // First try to find user by the email forwarding address
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, email, onesignal_player_id')
          .eq('email_forwarding_address', `${oneSignalPayload.email_id}@email.onesignal.com`)
          .single();

        if (!userError && userData) {
          userId = userData.id;
        } else {
          // If not found by forwarding address, try looking up by recipient email
          const { data: altUserData, error: altUserError } = await supabase
            .from('profiles')
            .select('id, email, onesignal_player_id')
            .eq('email', oneSignalPayload.email_address)
            .single();
            
          if (altUserError || !altUserData) {
            // As a last resort, check if the external user ID is set in OneSignal
            // This is a good practice for verification
            const appId = Deno.env.get('ONESIGNAL_APP_ID');
            const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
            
            if (appId && apiKey) {
              try {
                // Query OneSignal API to get the external user ID
                const response = await fetch(
                  `https://onesignal.com/api/v1/players/${oneSignalPayload.email_id}`,
                  {
                    headers: {
                      'Authorization': `Basic ${apiKey}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                
                if (response.ok) {
                  const playerData = await response.json();
                  if (playerData.external_user_id) {
                    // Use the external user ID which should be the Supabase user ID
                    userId = playerData.external_user_id;
                  }
                }
              } catch (externalIdError) {
                console.error('Error fetching from OneSignal API:', externalIdError);
              }
            }
            
            if (!userId) {
              throw new Error('User not found');
            }
          } else {
            userId = altUserData.id;
          }
        }
      } catch (userLookupError) {
        console.error('Error looking up user:', userLookupError);
        throw new Error('User not found');
      }
      
      // Format email data from OneSignal payload
      emailData = {
        to: oneSignalPayload.email_address,
        from: oneSignalPayload.from_address,
        from_name: oneSignalPayload.from_name,
        subject: oneSignalPayload.subject,
        text: oneSignalPayload.content_text,
        html: oneSignalPayload.content_html,
        timestamp: new Date(oneSignalPayload.timestamp * 1000).toISOString(),
      };
    } else if (body.email) {
      // This is a direct API call (old format)
      emailData = body.email;
      
      // Extract user_id from authentication or query params
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
          throw new Error('Unauthorized');
        }
        userId = data.user.id;
      } else if (body.user_id) {
        userId = body.user_id;
      } else {
        throw new Error('User ID not provided');
      }
    } else {
      throw new Error('Invalid payload format');
    }

    if (!userId) {
      throw new Error('User not found');
    }

    // Add to email processing queue
    const { data: queueData, error: queueError } = await supabase
      .from('email_queue')
      .insert({
        user_id: userId,
        email_data: emailData,
        status: 'pending',
        onesignal_notification_id: notificationId
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
      From: ${emailData.from || ''} ${emailData.from_name ? `(${emailData.from_name})` : ''}
      Subject: ${emailData.subject || ''}
      
      ${emailData.text || ''}
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
        // Store original time strings to preserve user intent
        const originalStartTime = eventData.start_time;
        const originalEndTime = eventData.end_time;
        
        // Prepare date objects for database
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
            user_id: userId,
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

    // Calculate processing time
    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    // Update email processing status
    await supabase
      .from('email_queue')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', queueData.id);
      
    // Log processing results
    await supabase
      .from('email_processing_logs')
      .insert({
        user_id: userId,
        email_queue_id: queueData.id,
        onesignal_notification_id: notificationId,
        status: 'success',
        events_created: processedEvents.length,
        processing_time_ms: processingTime
      });

    // Send notification to user about new events (if any)
    if (processedEvents.length > 0) {
      // Get OneSignal app ID and REST API key
      const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID');
      const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
      
      if (oneSignalAppId && oneSignalApiKey) {
        // Fetch user email for targeting
        const { data: userData } = await supabase
          .from('profiles')
          .select('email, onesignal_player_id')
          .eq('id', userId)
          .single();
          
        if (userData?.email || userData?.onesignal_player_id) {
          try {
            // Create notification payload
            const notificationPayload: any = {
              app_id: oneSignalAppId,
              headings: { en: 'New Events Added' },
              contents: { 
                en: `${processedEvents.length} new event${processedEvents.length > 1 ? 's' : ''} from email has been added to your calendar.` 
              },
              url: `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/calendar`
            };
            
            // If we have a player ID, use it directly
            if (userData.onesignal_player_id) {
              notificationPayload.include_player_ids = [userData.onesignal_player_id];
            } 
            // Otherwise fall back to email targeting
            else if (userData.email) {
              notificationPayload.filters = [
                { field: 'tag', key: 'email', relation: '=', value: userData.email }
              ];
            }
            
            // Send the notification
            await fetch('https://onesignal.com/api/v1/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${oneSignalApiKey}`
              },
              body: JSON.stringify(notificationPayload)
            });
          } catch (error) {
            console.error('Error sending OneSignal notification:', error);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email processed successfully. Created ${processedEvents.length} events.`,
        events_created: processedEvents.length,
        events: processedEvents,
        processing_time_ms: processingTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing email:', error);
    
    // Log the error
    if (userId) {
      // Calculate processing time
      const endTime = performance.now();
      const processingTime = Math.round(endTime - startTime);
      
      await supabase
        .from('email_processing_logs')
        .insert({
          user_id: userId,
          onesignal_notification_id: notificationId,
          status: 'error',
          error_message: error.message,
          processing_time_ms: processingTime
        }).catch(err => console.error('Error logging processing failure:', err));
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});