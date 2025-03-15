// frontend/src/services/familyService.ts
import { supabase } from './supabaseClient';
import { Family } from '../contexts/FamilyContext';

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile?: {
    display_name: string;
    id: string;
  };
}

export interface FamilyInvitation {
  id: string;
  family_id: string;
  email: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted: boolean;
}

/**
 * Create a new family
 */
export const createFamily = async (name: string): Promise<{ success: boolean; data?: Family; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // First create the family
    const { data: familyData, error: familyError } = await supabase
      .from('families')
      .insert({
        name,
        created_by: user.id
      })
      .select('*')
      .single();
      
    if (familyError) throw familyError;
    
    // Then add the creator as an owner
    const { error: memberError } = await supabase
      .from('family_members')
      .insert({
        family_id: familyData.id,
        user_id: user.id,
        role: 'owner',
        invitation_accepted: true
      });
      
    if (memberError) throw memberError;
    
    // Return with userRole added
    const familyWithRole: Family = {
      ...familyData,
      userRole: 'owner'
    };
    
    return { success: true, data: familyWithRole };
  } catch (error) {
    console.error('Error creating family:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create family' 
    };
  }
};

/**
 * Get all families for the current user
 */
export const getUserFamilies = async (): Promise<{ success: boolean; data?: Family[]; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    const { data, error } = await supabase
      .from('family_members')
      .select(`
        family_id,
        role,
        families:family_id (
          id,
          name,
          created_by,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .eq('invitation_accepted', true);
      
    if (error) throw error;
    
    // Transform the result to get a clean families array
    const userFamilies: Family[] = [];
    
    if (data && Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.families) {
          // Handle case where families could be an object or an array
          const familyData = Array.isArray(item.families) 
            ? item.families[0] 
            : item.families;
            
          if (familyData && familyData.id) {
            // Add the userRole to the family object
            userFamilies.push({
              id: familyData.id,
              name: familyData.name,
              created_by: familyData.created_by,
              created_at: familyData.created_at,
              userRole: item.role
            });
          }
        }
      });
    }
    
    return { success: true, data: userFamilies };
  } catch (error) {
    console.error('Error fetching user families:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch families' 
    };
  }
};

/**
 * Get family members
 */
export const getFamilyMembers = async (familyId: string): Promise<{ success: boolean; data?: FamilyMember[]; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Verify user is a member of this family
    const { data: memberCheck, error: memberError } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .eq('invitation_accepted', true)
      .single();
      
    if (memberError || !memberCheck) {
      throw new Error('Not authorized to view this family');
    }
    
    // Get all members with their profiles
    const { data, error } = await supabase
      .from('family_members')
      .select(`
        id,
        family_id,
        user_id,
        role,
        joined_at,
        profiles:user_id (
          id,
          display_name
        )
      `)
      .eq('family_id', familyId)
      .eq('invitation_accepted', true);
      
    if (error) throw error;
    
    // Process data to ensure consistent structure
    const processedMembers: FamilyMember[] = [];
    
    if (data && Array.isArray(data)) {
      data.forEach((item: any) => {
        const member: FamilyMember = {
          id: item.id,
          family_id: item.family_id,
          user_id: item.user_id,
          role: item.role,
          joined_at: item.joined_at
        };
        
        // Add profile if available
        if (item.profiles) {
          // Handle case where profiles could be an array
          const profileData = Array.isArray(item.profiles) 
            ? item.profiles[0]
            : item.profiles;
            
          if (profileData) {
            member.profile = {
              id: profileData.id,
              display_name: profileData.display_name
            };
          }
        }
        
        processedMembers.push(member);
      });
    }
    
    return { success: true, data: processedMembers };
  } catch (error) {
    console.error('Error fetching family members:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch family members' 
    };
  }
};

/**
 * Invite a new member to a family
 */
export const inviteFamilyMember = async (
  familyId: string, 
  email: string
): Promise<{ success: boolean; data?: FamilyInvitation; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Check if user is an owner of the family
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single();
      
    if (ownerError || !ownerCheck) {
      throw new Error('Only family owners can send invitations');
    }
    
    // First check if the user already exists
    const { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email);
      
    // Create invitation
    const { data: inviteData, error: inviteError } = await supabase
      .from('family_invitations')
      .insert({
        family_id: familyId,
        email,
        invited_by: user.id
      })
      .select('*')
      .single();
      
    if (inviteError) throw inviteError;
    
    // TODO: Send email invitation (would require additional setup with email provider)
    
    return { success: true, data: inviteData };
  } catch (error) {
    console.error('Error inviting family member:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to invite family member' 
    };
  }
};

/**
 * Accept a family invitation
 */
export const acceptInvitation = async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Get the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('family_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();
      
    if (inviteError || !invitation) {
      throw new Error('Invitation not found');
    }
    
    // Check if invitation is for the current user (compare emails)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();
      
    if (profileError || !profile) {
      throw new Error('User profile not found');
    }
    
    if (profile.email !== invitation.email) {
      throw new Error('This invitation is not for your account');
    }
    
    // Create family member record
    const { error: memberError } = await supabase
      .from('family_members')
      .insert({
        family_id: invitation.family_id,
        user_id: user.id,
        role: 'member',
        invitation_accepted: true
      });
      
    if (memberError) throw memberError;
    
    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('family_invitations')
      .update({ accepted: true })
      .eq('id', invitationId);
      
    if (updateError) throw updateError;
    
    return { success: true };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to accept invitation' 
    };
  }
};

/**
 * Leave a family
 */
export const leaveFamily = async (familyId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Check if user is the last owner
    const { data: owners, error: ownerError } = await supabase
      .from('family_members')
      .select('id, user_id')
      .eq('family_id', familyId)
      .eq('role', 'owner');
      
    if (ownerError) throw ownerError;
    
    // If this is the last owner and they're trying to leave, don't allow it
    if (owners.length === 1 && owners[0].user_id === user.id) {
      throw new Error('Cannot leave family as you are the only owner. Transfer ownership first or delete the family.');
    }
    
    // Remove the user from the family
    const { error: removeError } = await supabase
      .from('family_members')
      .delete()
      .eq('family_id', familyId)
      .eq('user_id', user.id);
      
    if (removeError) throw removeError;
    
    return { success: true };
  } catch (error) {
    console.error('Error leaving family:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to leave family' 
    };
  }
};

/**
 * Delete a family (only available to owners)
 */
export const deleteFamily = async (familyId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Check if user is an owner
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single();
      
    if (ownerError || !ownerCheck) {
      throw new Error('Only family owners can delete a family');
    }
    
    // Delete the family (cascade should handle related records)
    const { error: deleteError } = await supabase
      .from('families')
      .delete()
      .eq('id', familyId);
      
    if (deleteError) throw deleteError;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting family:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete family' 
    };
  }
};