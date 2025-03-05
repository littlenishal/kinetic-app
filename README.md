# Family Management Application

A chat-based family management application that helps busy families organize their lives through natural language interactions.

## Project Structure

The project consists of two main parts:
1. **Frontend**: React application with TypeScript
2. **Backend**: Supabase for database, authentication, and edge functions

## Setup Instructions

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Supabase account
- OpenAI API key

### Environment Variables

Create a `.env` file in the frontend directory with the following variables:

```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

For the edge functions, you'll need to set these environment variables in your Supabase project:

```
OPENAI_API_KEY=your_openai_api_key
```

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd family-management-app
   ```

2. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Deploy edge functions:
   ```
   cd ../edge-functions
   supabase functions deploy chat
   ```

## Features (MVP)

- **Chat-Based Calendar Interface**: Create and manage events using natural language
- **Event Creation**: Add events to your calendar by simply typing
- **Schedule Queries**: Ask about upcoming events
- **User Authentication**: Secure login with Google OAuth

## Development Tasks

- [x] Set up Supabase project
- [x] Configure environment variables
- [x] Implement chat interface components
- [x] Create OpenAI integration for natural language processing
- [ ] Implement email forwarding for event creation
- [ ] Set up notification system
- [ ] Add weekly and daily schedule views

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.