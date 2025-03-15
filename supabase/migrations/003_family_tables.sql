-- supabase/migrations/003_family_tables.sql
-- Adds tables and modifications for family sharing functionality

-- Check if families table exists before creating
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'families') THEN
    -- Family groups table
    CREATE TABLE public.families (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name TEXT NOT NULL,
      created_by UUID REFERENCES auth.users NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- Enable RLS for family table
    ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'Created families table';
  ELSE
    RAISE NOTICE 'Families table already exists, skipping creation';
  END IF;
END
$$;

-- Check if family_members table exists before creating
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'family_members') THEN
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
    
    -- Enable RLS for family members table
    ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'Created family_members table';
  ELSE
    RAISE NOTICE 'Family_members table already exists, skipping creation';
  END IF;
END
$$;

-- Check if family_invitations table exists before creating
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'family_invitations') THEN
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
    
    -- Enable RLS for family invitations table
    ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'Created family_invitations table';
  ELSE
    RAISE NOTICE 'Family_invitations table already exists, skipping creation';
  END IF;
END
$$;

-- Add family_id to events table if column doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE public.events 
    ADD COLUMN family_id UUID REFERENCES public.families;
    
    RAISE NOTICE 'Added family_id column to events table';
  ELSE
    RAISE NOTICE 'family_id column already exists in events table, skipping addition';
  END IF;
END
$$;

-- Create RLS policies for families if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'families' AND policyname = 'Users can view families they are members of'
  ) THEN
    CREATE POLICY "Users can view families they are members of" 
      ON public.families FOR SELECT 
      USING (
        id IN (
          SELECT family_id FROM public.family_members 
          WHERE user_id = auth.uid() AND invitation_accepted = TRUE
        )
      );
    RAISE NOTICE 'Created view policy for families table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'families' AND policyname = 'Users can update families they own'
  ) THEN
    CREATE POLICY "Users can update families they own" 
      ON public.families FOR UPDATE 
      USING (
        id IN (
          SELECT family_id FROM public.family_members 
          WHERE user_id = auth.uid() AND role = 'owner'
        )
      );
    RAISE NOTICE 'Created update policy for families table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'families' AND policyname = 'Only family owners can delete families'
  ) THEN
    CREATE POLICY "Only family owners can delete families" 
      ON public.families FOR DELETE
      USING (
        id IN (
          SELECT family_id FROM public.family_members 
          WHERE user_id = auth.uid() AND role = 'owner'
        )
      );
    RAISE NOTICE 'Created delete policy for families table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'families' AND policyname = 'Users can create families'
  ) THEN
    CREATE POLICY "Users can create families" 
      ON public.families FOR INSERT 
      WITH CHECK (created_by = auth.uid());
    RAISE NOTICE 'Created insert policy for families table';
  END IF;
END
$$;

-- Create RLS policies for family members if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'family_members' AND policyname = 'Users can view members of their families'
  ) THEN
    CREATE POLICY "Users can view members of their families" 
      ON public.family_members FOR SELECT 
      USING (
        family_id IN (
          SELECT family_id FROM public.family_members 
          WHERE user_id = auth.uid() AND invitation_accepted = TRUE
        )
      );
    RAISE NOTICE 'Created view policy for family_members table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'family_members' AND policyname = 'Users can insert themselves as members'
  ) THEN
    CREATE POLICY "Users can insert themselves as members"
      ON public.family_members FOR INSERT
      WITH CHECK (user_id = auth.uid());
    RAISE NOTICE 'Created insert policy for family_members table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'family_members' AND policyname = 'Users can delete their own memberships'
  ) THEN
    CREATE POLICY "Users can delete their own memberships"
      ON public.family_members FOR DELETE
      USING (user_id = auth.uid());
    RAISE NOTICE 'Created delete policy for family_members table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'family_members' AND policyname = 'Only owners can manage members'
  ) THEN
    CREATE POLICY "Only owners can manage members"
      ON public.family_members FOR UPDATE
      USING (
        family_id IN (
          SELECT family_id FROM public.family_members 
          WHERE user_id = auth.uid() AND role = 'owner'
        )
      );
    RAISE NOTICE 'Created update policy for family_members table';
  END IF;
END
$$;

-- Create RLS policies for family invitations if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'family_invitations' AND policyname = 'Users can view invitations for their families'
  ) THEN
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
    RAISE NOTICE 'Created view policy for family_invitations table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'family_invitations' AND policyname = 'Only owners can create invitations'
  ) THEN
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
    RAISE NOTICE 'Created insert policy for family_invitations table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'family_invitations' AND policyname = 'Only owners or invited users can update invitations'
  ) THEN
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
    RAISE NOTICE 'Created update policy for family_invitations table';
  END IF;
END
$$;

-- Update events RLS policies to include family events
DO $$
BEGIN
  -- First drop existing policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "Users can view own events" ON public.events;
    EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Policy "Users can view own events" does not exist or could not be dropped';
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
    EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Policy "Users can insert own events" does not exist or could not be dropped';
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can update own events" ON public.events;
    EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Policy "Users can update own events" does not exist or could not be dropped';
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete own events" ON public.events;
    EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Policy "Users can delete own events" does not exist or could not be dropped';
  END;

  -- Now create the new policies
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Users can view events'
  ) THEN
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
    RAISE NOTICE 'Created view policy for events table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Users can insert events'
  ) THEN
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
    RAISE NOTICE 'Created insert policy for events table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Users can update events'
  ) THEN
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
    RAISE NOTICE 'Created update policy for events table';
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Users can delete events'
  ) THEN
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
    RAISE NOTICE 'Created delete policy for events table';
  END IF;
END
$$;

-- Add email field to profiles for invitations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN email TEXT;
    
    RAISE NOTICE 'Added email column to profiles table';
  ELSE
    RAISE NOTICE 'Email column already exists in profiles table, skipping addition';
  END IF;
END
$$;

-- Create or replace the email sync function
CREATE OR REPLACE FUNCTION public.sync_profile_email() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_trigger 
    WHERE tgname = 'on_profile_created' AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER on_profile_created
      BEFORE INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();
    
    RAISE NOTICE 'Created email sync trigger for profiles table';
  ELSE
    RAISE NOTICE 'Email sync trigger already exists, skipping creation';
  END IF;
END
$$;

-- Update existing profiles with email
UPDATE public.profiles 
SET email = (SELECT email FROM auth.users WHERE id = profiles.id)
WHERE email IS NULL;