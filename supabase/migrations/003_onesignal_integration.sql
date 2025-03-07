-- supabase/migrations/003_onesignal_integration.sql

-- Add OneSignal-related fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN email_forwarding_address TEXT,
ADD COLUMN onesignal_player_id TEXT,
ADD COLUMN onesignal_email_id TEXT;

-- Update email queue table to handle OneSignal payload format
ALTER TABLE public.email_queue
ADD COLUMN onesignal_notification_id TEXT;

-- Create a new table to track email processing metadata
CREATE TABLE public.email_processing_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  email_queue_id UUID REFERENCES public.email_queue(id),
  onesignal_notification_id TEXT,
  status TEXT NOT NULL,
  events_created INTEGER DEFAULT 0,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Set up RLS for new table
ALTER TABLE public.email_processing_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for email_processing_logs
CREATE POLICY "Users can view own email processing logs" 
  ON public.email_processing_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- Function to process incoming emails from OneSignal webhook
CREATE OR REPLACE FUNCTION public.process_onesignal_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the incoming email in the queue
  INSERT INTO public.email_queue (
    user_id,
    email_data,
    status,
    onesignal_notification_id
  ) VALUES (
    NEW.user_id,
    NEW.email_data,
    'pending',
    NEW.onesignal_notification_id
  );
  
  -- The actual processing will be done by the email-processing edge function
  -- which will be triggered by a webhook from OneSignal
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;