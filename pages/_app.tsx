import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  // Lead detail and PIN screen don't use sidebar layout
  const noLayout = router.pathname.startsWith('/leads/');

  if (noLayout) {
    return <Component {...pageProps} />;
  }

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
