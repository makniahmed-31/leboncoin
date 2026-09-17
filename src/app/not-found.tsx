import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold">Conversation introuvable</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Cette discussion n&rsquo;existe pas ou ne vous est pas accessible.
      </p>
      <Link href="/conversations" className="text-primary font-medium underline">
        Revenir a mes messages
      </Link>
    </div>
  )
}
