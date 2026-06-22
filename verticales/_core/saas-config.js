const SAAS_CONFIG = {
  supabase: {
    url: 'https://khvfhvpqhcchgxrtmrjo.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtodmZodnBxaGNjaGd4cnRtcmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MzkwNTMsImV4cCI6MjA5NjExNTA1M30.lYHscLNuqaB1UObLDRbPLJH5vFm--WPTitN8lJXZeF4'
  },
  routes: {
    superAdmin:  '/OPS/saas-clientes.html',
    tenantOwner: '/verticales/peluquerias/dashboard.html',
    tenantStaff: '/verticales/peluquerias/mi-billetera.html',
    login:       '/verticales/peluquerias/login.html',
    bookingBase: '/verticales/peluquerias/public/booking.html',
    wallet:      '/verticales/peluquerias/mi-billetera.html'
  },
  plans: {
    starter: { name: 'Starter', price_clp: 29900, max_staff: 1 },
    pro:     { name: 'Pro',     price_clp: 79900, max_staff: 4 },
    studio:  { name: 'Studio',  price_clp: 149900, max_staff: 10 }
  }
};
