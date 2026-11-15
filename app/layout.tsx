import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'River Room', description:'Play-money Texas Hold’em with a table full of personalities.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
