import { Throttle } from '@nestjs/throttler'

export const AuthThrottle = () => Throttle({ auth: {} })
export const AgentThrottle = () => Throttle({ agent: {} })
