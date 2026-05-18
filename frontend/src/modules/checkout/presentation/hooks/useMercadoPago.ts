import { useEffect, useRef, useState } from 'react';
import { appConfig } from '../../../shared/config/AppConfig';

export function useMercadoPago() {
  const mpRef = useRef<InstanceType<typeof window.MercadoPago> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = () => {
      if (window.MercadoPago && !mpRef.current) {
        mpRef.current = new window.MercadoPago(appConfig.mpPublicKey, { locale: 'es-MX' });
        setReady(true);
      }
    };

    if (window.MercadoPago) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.MercadoPago) { clearInterval(interval); init(); }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  return { mp: mpRef.current, ready };
}
