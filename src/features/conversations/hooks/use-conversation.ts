'use client'

import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'

import { fetchConversation } from '../api/client'

export function useConversation(conversationId: number) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId),
    queryFn: ({ signal }) => fetchConversation(conversationId, signal),
  })
}
