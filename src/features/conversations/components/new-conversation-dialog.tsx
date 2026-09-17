'use client'

import { useRouter } from 'next/navigation'
import { useDeferredValue, useMemo, useState } from 'react'
import { formatPrice, type User } from '@/lib/contracts'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Spinner } from '@/shared/ui/spinner'
import { ErrorState } from '@/shared/ui/states'
import { UserAvatar } from '@/shared/ui/user-avatar'
import { BackIcon } from '@/shared/ui/icons'
import { cn } from '@/lib/utils'

import { useContacts, useCreateConversation, useProducts } from '../hooks/use-conversations'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingCounterpartIds: number[]
  trigger: React.ReactNode
}

/**
 * shadcn's Dialog, which is Radix underneath. The parts that are tedious to get right and easy to
 * get wrong — focus trapping, restoring focus to the trigger on close, Escape, inert background,
 * aria-modal — are exactly what it provides. Writing them again would be a worse version of this.
 *
 * The trigger is passed in and rendered through DialogTrigger rather than being wired up with a
 * plain onClick outside. Radix needs to own that relationship to put focus back on the button
 * when the dialog closes; without it, focus lands on the document body and a keyboard user
 * restarts their journey through the page.
 */
export function NewConversationDialog({
  open,
  onOpenChange,
  existingCounterpartIds,
  trigger,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  /*
   * A second step rather than another control on the first one.
   *
   * Which listing a message is about only makes sense once the member is known — any other
   * arrangement means showing someone a list of listings that mostly belong to people they are
   * not writing to. When the member sells nothing the step is skipped entirely, so the common
   * case stays a single tap.
   */
  const [recipient, setRecipient] = useState<User | null>(null)

  // The directory is small enough to filter in the browser, but the input still updates ahead of
  // the list so typing never waits on a re-render of the results.
  const deferredSearch = useDeferredValue(search)

  const { data: contacts, isPending, isError, error, refetch } = useContacts(open)
  const { data: products } = useProducts(open)
  const createConversation = useCreateConversation()

  const existing = useMemo(() => new Set(existingCounterpartIds), [existingCounterpartIds])

  const results = useMemo(() => {
    const needle = deferredSearch.trim().toLocaleLowerCase('fr')
    if (!contacts) return []
    if (!needle) return contacts
    return contacts.filter((contact) => contact.nickname.toLocaleLowerCase('fr').includes(needle))
  }, [contacts, deferredSearch])

  const recipientListings = useMemo(
    () =>
      recipient ? (products ?? []).filter((product) => product.sellerId === recipient.id) : [],
    [products, recipient]
  )

  const reset = () => {
    setSearch('')
    setRecipient(null)
  }

  const start = (recipientId: number, productId?: number) => {
    createConversation.mutate(
      { recipientId, ...(productId === undefined ? {} : { productId }) },
      {
        onSuccess: (conversation) => {
          onOpenChange(false)
          reset()
          router.push(`/conversations/${conversation.id}`)
        },
      }
    )
  }

  const chooseRecipient = (contact: User) => {
    const listings = (products ?? []).filter((product) => product.sellerId === contact.id)
    // Nothing to choose between means no second step at all.
    if (listings.length === 0) {
      start(contact.id)
      return
    }
    setRecipient(contact)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {/*
        shadcn's own close button is suppressed: its label is the registry's English "Close", and
        an unlabelled X in a French interface is worse than the explicit button in the header
        below. Its padding and gap are dropped too: the results list has to scroll edge to edge,
        so each section owns its own gutter instead. They all sit on the same 20px line — the
        rows reach it as 12px on the scroll container plus 8px on the row, which leaves the hover
        pill wider than its text and keeps it off the scrollbar.
      */}
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          // Full screen on a phone, a centred panel from the small breakpoint up.
          'inset-x-0 top-0 bottom-0 max-w-none translate-x-0 translate-y-0 rounded-none border-0',
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[32rem] sm:w-[28rem] sm:max-w-lg',
          'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border'
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-1.5">
            {recipient ? (
              <button
                type="button"
                onClick={() => setRecipient(null)}
                aria-label="Revenir au choix du membre"
                className="text-muted-foreground hover:bg-muted -ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              >
                <BackIcon className="h-5 w-5" />
              </button>
            ) : null}

            {/*
              One title element whose text changes, rather than two swapped in and out. A dialog
              that replaces the element its own accessible name points at can leave a screen
              reader announcing a heading that no longer exists.
            */}
            <DialogTitle className="truncate text-lg font-semibold">
              {recipient ? recipient.nickname : 'Nouvelle conversation'}
            </DialogTitle>
          </div>

          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Fermer
            </Button>
          </DialogClose>
        </div>

        <DialogDescription className="text-muted-foreground px-5 pt-4 text-sm">
          {recipient
            ? 'De quelle annonce souhaitez-vous parler ?'
            : 'Choisissez un membre pour demarrer une discussion.'}
        </DialogDescription>

        {recipient ? null : (
          <div className="px-5 py-3">
            <label htmlFor="contact-search" className="sr-only">
              Rechercher un membre
            </label>
            <Input
              id="contact-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un membre"
              autoComplete="off"
              className="h-11 rounded-full px-4 text-[15px]"
            />
          </div>
        )}

        {/*
          Radix's overlay scrollbar rather than the platform one. The native bar is rendered by
          the OS — on Linux that means stepper arrows and a full-height trough butting against the
          panel's rounded corner. This one is a thumb drawn over a viewport that still scrolls
          natively, so the wheel, the keyboard and touch momentum are unchanged.

          The thumb colour is overridden here rather than in scroll-area.tsx, which stays as the
          registry wrote it. The default is `bg-border`, the same near-white the panel's own
          hairlines use: correct as a border, invisible as a control. A scrollbar nobody can see
          does not tell anyone the list continues.
        */}
        <ScrollArea
          className={cn(
            'mt-1 min-h-0 flex-1 border-t',
            '[&>[data-slot=scroll-area-scrollbar]]:my-2 [&>[data-slot=scroll-area-scrollbar]]:mr-1',
            '[&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/35',
            'hover:[&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55'
          )}
        >
          {/* Wider on the right than the left: the overlay scrollbar sits in that gutter, and
              without the extra room the row's hover pill runs underneath it. */}
          <div className="pt-2 pr-5 pb-5 pl-3">
            {recipient ? (
              <ul aria-label="Annonces du membre">
                {recipientListings.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => start(recipient.id, product.id)}
                      disabled={createConversation.isPending}
                      className="hover:bg-muted flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left disabled:opacity-50"
                    >
                      <span
                        aria-hidden="true"
                        className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      >
                        {product.title.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{product.title}</span>
                      <span className="text-muted-foreground shrink-0 text-sm">
                        {formatPrice(product)}
                      </span>
                    </button>
                  </li>
                ))}

                <li className="mt-1 border-t pt-1">
                  <button
                    type="button"
                    onClick={() => start(recipient.id)}
                    disabled={createConversation.isPending}
                    className="hover:bg-muted text-muted-foreground w-full rounded-xl px-2 py-2.5 text-left text-sm disabled:opacity-50"
                  >
                    Sans annonce particuliere
                  </button>
                </li>
              </ul>
            ) : isPending ? (
              <div className="text-muted-foreground flex justify-center py-10">
                <Spinner className="h-6 w-6" />
              </div>
            ) : isError ? (
              <ErrorState description={error.message} onRetry={() => void refetch()} />
            ) : results.length === 0 ? (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                Aucun membre ne correspond a cette recherche.
              </p>
            ) : (
              <ul aria-label="Membres">
                {results.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => chooseRecipient(contact)}
                      disabled={createConversation.isPending}
                      className="hover:bg-muted flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left disabled:opacity-50"
                    >
                      <UserAvatar
                        nickname={contact.nickname}
                        userId={contact.id}
                        className="h-9 w-9"
                      />
                      <span className="flex-1 truncate font-medium">{contact.nickname}</span>
                      {existing.has(contact.id) ? (
                        // Saying so up front is better than silently redirecting to a thread the
                        // user did not expect: the API returns the existing conversation rather
                        // than creating a second one for the same pair and listing.
                        <span className="text-muted-foreground text-xs">Discussion existante</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>

        {createConversation.isError ? (
          <p role="alert" className="border-border text-destructive border-t px-5 py-3 text-sm">
            {createConversation.error.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
