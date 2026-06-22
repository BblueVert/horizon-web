-- ═══════════════════════════════════════════════════════════════════════════
-- Migración 007 — Billeteras de barberos y sistema de retiros
-- Proyecto: horizon-saas (khvfhvpqhcchgxrtmrjo)
-- Ejecutar en: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Vincular barbero con usuario auth (login propio) ───────────────────
ALTER TABLE biz_staff
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Billetera por barbero ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_barber_wallets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id             UUID NOT NULL REFERENCES biz_staff(id) ON DELETE CASCADE,
  balance_clp          INTEGER NOT NULL DEFAULT 0,
  total_earned_clp     INTEGER NOT NULL DEFAULT 0,
  total_withdrawn_clp  INTEGER NOT NULL DEFAULT 0,
  payout_preference    TEXT NOT NULL DEFAULT 'manual'
                         CHECK (payout_preference IN ('instant','end_of_day','manual')),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, staff_id)
);

-- ── 3. Transacciones de billetera ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id      UUID NOT NULL REFERENCES biz_staff(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('credit','withdrawal')),
  amount_clp    INTEGER NOT NULL,
  sale_id       UUID REFERENCES biz_sales(id) ON DELETE SET NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','rejected')),
  requested_at  TIMESTAMPTZ DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 4. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE biz_barber_wallets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE biz_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Owner: acceso total a su tenant
DROP POLICY IF EXISTS "owner_wallets_all" ON biz_barber_wallets;
CREATE POLICY "owner_wallets_all" ON biz_barber_wallets
  FOR ALL USING (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "owner_wallet_tx_all" ON biz_wallet_transactions;
CREATE POLICY "owner_wallet_tx_all" ON biz_wallet_transactions
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- Staff: lee solo su propia billetera
DROP POLICY IF EXISTS "staff_own_wallet_read" ON biz_barber_wallets;
CREATE POLICY "staff_own_wallet_read" ON biz_barber_wallets
  FOR SELECT USING (
    tenant_id = get_my_tenant_id() AND
    staff_id IN (SELECT id FROM biz_staff WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_own_wallet_tx_read" ON biz_wallet_transactions;
CREATE POLICY "staff_own_wallet_tx_read" ON biz_wallet_transactions
  FOR SELECT USING (
    tenant_id = get_my_tenant_id() AND
    staff_id IN (SELECT id FROM biz_staff WHERE auth_user_id = auth.uid())
  );

-- Staff puede solicitar retiros
DROP POLICY IF EXISTS "staff_request_withdrawal" ON biz_wallet_transactions;
CREATE POLICY "staff_request_withdrawal" ON biz_wallet_transactions
  FOR INSERT WITH CHECK (
    type = 'withdrawal' AND
    tenant_id = get_my_tenant_id() AND
    staff_id IN (SELECT id FROM biz_staff WHERE auth_user_id = auth.uid())
  );

-- ── 5. Wallets iniciales para el demo (Barbería O'Higgins) ────────────────
-- Genera una wallet en 0 para cada barbero activo del tenant demo.
-- Si ya existen, no hace nada (ON CONFLICT DO NOTHING).
INSERT INTO biz_barber_wallets (tenant_id, staff_id, balance_clp, payout_preference)
SELECT
  s.tenant_id,
  s.id,
  0,
  'manual'
FROM biz_staff s
WHERE s.active = true
ON CONFLICT (tenant_id, staff_id) DO NOTHING;

-- ── 6. Datos demo: créditos y retiros de ejemplo ──────────────────────────
-- Insertar algunas transacciones demo para que la vista no llegue vacía.
-- Requiere que los staff_id de O'Higgins existan. Usa subquery para ser
-- idempotente (si ya hay transacciones del mismo note, no duplica).
DO $$
DECLARE
  v_tenant_id UUID;
  v_staff     RECORD;
  v_amounts   INTEGER[] := ARRAY[8000, 12000, 9500, 11000];
  v_notes     TEXT[]    := ARRAY['Corte + fade', 'Corte clásico', 'Barba + corte', 'Degradado'];
  i           INTEGER := 1;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'ohiggins' LIMIT 1;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  FOR v_staff IN
    SELECT id FROM biz_staff WHERE tenant_id = v_tenant_id AND active = true ORDER BY name LIMIT 4
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM biz_wallet_transactions
      WHERE staff_id = v_staff.id AND note = v_notes[i]
    ) THEN
      INSERT INTO biz_wallet_transactions
        (tenant_id, staff_id, type, amount_clp, note, status, processed_at)
      VALUES
        (v_tenant_id, v_staff.id, 'credit', v_amounts[i], v_notes[i], 'completed', now() - interval '2 hours'),
        (v_tenant_id, v_staff.id, 'credit', v_amounts[i] + 3000, 'Corte express', 'completed', now() - interval '5 hours');

      UPDATE biz_barber_wallets
        SET balance_clp = v_amounts[i] + (v_amounts[i] + 3000),
            total_earned_clp = v_amounts[i] + (v_amounts[i] + 3000)
      WHERE staff_id = v_staff.id AND tenant_id = v_tenant_id;
    END IF;

    i := i + 1;
    IF i > 4 THEN EXIT; END IF;
  END LOOP;
END;
$$;
