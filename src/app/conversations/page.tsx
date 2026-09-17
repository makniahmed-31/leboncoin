/**
 * The desktop right-hand pane before anything is selected. On a phone this route renders the
 * list alone and this placeholder is never shown, which is why it carries no navigation of its
 * own.
 */
export default function ConversationsIndexPage() {
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-2 px-6 text-center md:flex">
      <p className="text-lg font-semibold">Selectionnez une conversation</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        Choisissez une discussion dans la liste pour lire et repondre aux messages.
      </p>
    </div>
  )
}
