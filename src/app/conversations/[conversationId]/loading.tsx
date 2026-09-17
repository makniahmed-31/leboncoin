import { ConversationHeaderSkeleton, MessageThreadSkeleton } from '@/shared/ui/skeletons'

/**
 * The placeholder now includes the header, which is what the design calls for and what the route
 * actually does: the header is server-rendered from the conversation, so while that request is in
 * flight there is no name to show either. Ending the placeholder at the message list left the
 * header area blank and the pane visibly grew a row when the data landed.
 */
export default function ConversationLoading() {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <span className="sr-only">Chargement de la conversation</span>

      <div className="border-border flex items-center gap-3 border-b px-3 py-3 sm:px-4">
        <ConversationHeaderSkeleton />
      </div>

      <div className="flex-1 px-3 py-5 sm:px-6">
        <MessageThreadSkeleton />
      </div>
    </div>
  )
}
