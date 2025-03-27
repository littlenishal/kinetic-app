// frontend/src/types/index.ts
// Common Types for the Kinetic App

// User-related types
export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Family-related types
export interface Family {
  id: string;
  name: string;
  userRole?: 'owner' | 'member';
  created_by?: string;
  created_at?: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'owner' | 'member';
  display_name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface FamilyInvite {
  id: string;
  family_id: string;
  email: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

// Event-related types
export interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  created_by: string;
  family_id?: string;
  created_at: string;
  updated_at: string;
  all_day?: boolean;
}

export interface EventPreviewData {
  id?: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  allDay?: boolean;
}

// Chat and messaging types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
}

export interface Conversation {
  id?: string;
  user_id: string;
  messages: Message[];
  created_at?: string;
  updated_at?: string;
}

export interface ProcessMessageResult {
  message: string;
  intent?: string;
  event?: any;
  events?: any[];
  existing_event_id?: string;
  error?: string;
}

// Service response types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form types
export interface FormErrors {
  [key: string]: string;
}

// Navigation types
export type NavigationView = 'chat' | 'calendar';