-- supabase/migrations/003_family_tables.sql
-- Adds tables and modifications for family sharing functionality

-- Family groups table
CREATE TABLE public.families (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Family members junction table
CREATE TABLE public.family_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES public.families NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' or 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  invitation_accepted BOOLEAN DEFAULT TRUE,
  UNIQUE(family_id, user_id)
);

-- Family invitations table
CREATE TABLE public.family_invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES public.families NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  accepted BOOLEAN DEFAULT FALSE,
  UNIQUE(family_id, email)
);

-- Add family_id to events table
ALTER TABLE public.events 
ADD COLUMN family_id UUID REFERENCES public.families;

-- Enable RLS for family tables
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for families
CREATE POLICY "Users can view families they are members of" 
  ON public.families FOR SELECT 
  USING (
    id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND invitation_accepted = TRUE
    )
  );

CREATE POLICY "Users can update families they own" 
  ON public.families FOR UPDATE 
  USING (
    id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Only family owners can delete families" 
  ON public.families FOR DELETE
  USING (
    id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Users can create families" 
  ON public.families FOR INSERT 
  WITH CHECK (created_by = auth.uid());

-- Create RLS policies for family members
CREATE POLICY "Users can view members of their families" 
  ON public.family_members FOR SELECT 
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND invitation_accepted = TRUE
    )
  );

CREATE POLICY "Users can insert themselves as members"
  ON public.family_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own memberships"
  ON public.family_members FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Only owners can manage members"
  ON public.family_members FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Create RLS policies for family invitations
CREATE POLICY "Users can view invitations for their families" 
  ON public.family_invitations FOR SELECT 
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
    OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Only owners can create invitations"
  ON public.family_invitations FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
    AND
    invited_by = auth.uid()
  );

CREATE POLICY "Only owners or invited users can update invitations"
  ON public.family_invitations FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
    OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Update events RLS policies to include family events
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
CREATE POLICY "Users can view events" 
  ON public.events FOR SELECT 
  USING (
    user_id = auth.uid()
    OR
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND invitation_accepted = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
CREATE POLICY "Users can insert events"
  ON public.events FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND invitation_accepted = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can update own events" ON public.events;
CREATE POLICY "Users can update events"
  ON public.events FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND invitation_accepted = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can delete own events" ON public.events;
CREATE POLICY "Users can delete events"
  ON public.events FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    family_id IN (
      SELECT family_id FROM public.family_members 
      WHERE user_id = auth.uid() AND invitation_accepted = TRUE
    )
  );

-- Add email field to profiles for invitations
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create a trigger to automatically set email field from auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_email() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Update existing profiles with email
UPDATE public.profiles 
SET email = (SELECT email FROM auth.users WHERE id = profiles.id)
WHERE email IS NULL;