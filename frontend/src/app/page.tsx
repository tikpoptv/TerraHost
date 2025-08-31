import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect ไปหน้า login โดยอัตโนมัติ
  redirect('/login');
}
