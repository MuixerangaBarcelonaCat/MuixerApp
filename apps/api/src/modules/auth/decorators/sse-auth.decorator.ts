import { SetMetadata } from '@nestjs/common';
import { IS_SSE_KEY } from '../constants/auth.constants';

/**
 * Marks a route/controller as authenticating via the SSE-scoped JWT strategy,
 * which also accepts the token as a `?token=` query parameter — required
 * because the browser's EventSource API cannot set custom headers. Every
 * other route only accepts the Authorization header (SEC-4).
 */
export const SseAuth = () => SetMetadata(IS_SSE_KEY, true);
