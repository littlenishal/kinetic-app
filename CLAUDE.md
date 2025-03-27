# CLAUDE.md - Guidelines for Kinetic App

## Build & Testing Commands
- Start development server: `cd frontend && npm start`
- Run all tests: `cd frontend && npm test`
- Run single test: `cd frontend && npm test -- -t "test name pattern"`
- Build for production: `cd frontend && npm run build`
- Run linting: `cd frontend && npm run lint`
- Run type checking: `cd frontend && npm run typecheck`

## Code Style Guidelines
- **TypeScript**: Strict mode enabled with proper type definitions
- **Imports**: 
  - Use absolute imports with `@/` prefix (baseUrl is set to "src")
  - Group imports: React, third-party libraries, components, styles
- **Naming**:
  - Components: PascalCase (.tsx files)
  - Hooks: camelCase with "use" prefix (useEventManagement)
  - Utilities: camelCase
- **Error Handling**: Use try/catch blocks for async operations and ErrorBoundary for React components
- **Component Structure**: Use functional components with hooks
- **Styling**: Use dedicated CSS files in the styles directory
- **Testing**: Use React Testing Library with Jest matchers

## Project Organization
The codebase follows a feature-based organization with React 19 and TypeScript.
Backend uses Supabase for database, authentication, and edge functions.

## Custom Hooks
- **useLoading**: Managing loading states with descriptive messages
- **useFormValidation**: Form validation with custom rules
- **useFetch**: API calls with loading and error handling
- **useLocalStorage**: Persistent storage with type safety
- **useConversation**: Chat conversation management
- **useEventManagement**: Calendar event management

## Error Handling
- Use `ErrorBoundary` component for React component errors
- Use `try/catch` blocks for async operations
- Use `useFetch` hook for API call error handling

## Forms and Validation
- Use `FormField` component for consistent form fields with validation
- Use `useFormValidation` hook for form validation rules
- Include proper accessibility attributes for form elements

## Loading States
- Use `LoadingSpinner` component for consistent loading indicators
- Use `useLoading` hook to manage loading states in components
- Include meaningful loading messages for better UX