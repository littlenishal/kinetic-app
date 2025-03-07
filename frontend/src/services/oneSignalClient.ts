// frontend/src/services/oneSignalClient.ts

interface OneSignalConfig {
    appId: string;
  }
  
  /**
   * Initialize OneSignal client for both push notifications and email
   */
  export const initializeOneSignal = (config: OneSignalConfig): void => {
    // Add OneSignal Script to head
    const scriptElement = document.createElement('script');
    scriptElement.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
    scriptElement.async = true;
    document.head.appendChild(scriptElement);
  
    // Initialize OneSignal once the script is loaded
    scriptElement.onload = () => {
      if (window.OneSignal) {
        window.OneSignal.init({
          appId: config.appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: false,
          },
        });
      }
    };
  };
  
  /**
   * Set up user in OneSignal with their ID and email
   */
  export const setupOneSignalUser = async (userId: string, email: string): Promise<void> => {
    if (!window.OneSignal) {
      console.error('OneSignal not initialized');
      return;
    }
  
    try {
      // First set the external user ID to link with Supabase ID
      await window.OneSignal.setExternalUserId(userId);
      
      // Then set the user's email
      await window.OneSignal.setEmail(email);
      console.log('User set up in OneSignal:', email);
    } catch (error) {
      console.error('Error setting up user in OneSignal:', error);
    }
  };
  
  /**
   * Get the email inbox address from OneSignal that users should forward emails to
   */
  export const getOneSignalEmailInbox = async (): Promise<string | null> => {
    if (!window.OneSignal) {
      console.error('OneSignal not initialized');
      return null;
    }
  
    try {
      // Get the OneSignal email ID - this is used to construct the inbox address
      const emailId = await window.OneSignal.getEmailId();
      
      if (emailId) {
        // The format is typically: {emailId}@email.onesignal.com
        return `${emailId}@email.onesignal.com`;
      }
      return null;
    } catch (error) {
      console.error('Error getting OneSignal email inbox:', error);
      return null;
    }
  };
  
  /**
   * Remove user from OneSignal on logout
   */
  export const removeOneSignalUser = async (): Promise<void> => {
    if (!window.OneSignal) {
      console.error('OneSignal not initialized');
      return;
    }
  
    try {
      // Clear the external user ID when user logs out
      await window.OneSignal.removeExternalUserId();
      console.log('User removed from OneSignal');
    } catch (error) {
      console.error('Error removing user from OneSignal:', error);
    }
  };
  
  // Add TypeScript definitions for OneSignal
  declare global {
    interface Window {
      OneSignal?: {
        init: (config: any) => void;
        setExternalUserId: (id: string) => Promise<void>;
        removeExternalUserId: () => Promise<void>;
        setEmail: (email: string) => Promise<void>;
        getEmailId: () => Promise<string>;
      };
    }
  }