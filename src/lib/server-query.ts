import 'server-only'

import { cache } from 'react'

import { createQueryClient } from './query-client'

/**
 * One query client per request, not per process: `cache` scopes it to the render, so a Server
 * Component and the page it renders share a cache while two concurrent visitors never do.
 */
export const getServerQueryClient = cache(createQueryClient)
