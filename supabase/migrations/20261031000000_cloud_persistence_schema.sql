-- ============================================================================
-- ZESTFLOW OS: PHASE 1 STAGING CLOUD PERSISTENCE DDL
-- Target Staging Project: mlxyegiwdzmcybvhtgwy
-- Author: Mohammed Ali Quadri (CodeWithAli)
-- ============================================================================

-- Ensure pgcrypto is available for SHA-256 payload digest calculation
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Clean grant slate
REVOKE ALL ON SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1. Permanent Account Sequence Head & Watermark Table
CREATE TABLE IF NOT EXISTS public.account_sync_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_change_seq BIGINT NOT NULL DEFAULT 0,
  tombstone_clean_seq BIGINT NOT NULL DEFAULT 0,
  tombstone_clean_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- 2. User Business Profiles Table (Settings, Defaults, Preferences, Assets)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  business_address TEXT NOT NULL DEFAULT '',
  business_state TEXT NOT NULL DEFAULT '',
  business_email TEXT NOT NULL DEFAULT '',
  business_phone TEXT NOT NULL DEFAULT '',
  tax_id_label TEXT NOT NULL DEFAULT 'Tax ID',
  tax_id TEXT NOT NULL DEFAULT '',
  tax_regime TEXT NOT NULL DEFAULT 'simple' CHECK (tax_regime IN ('simple', 'gst_in')),
  upi_id TEXT NOT NULL DEFAULT '',
  payment_link TEXT NOT NULL DEFAULT '',
  zatca_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_webhook TEXT NOT NULL DEFAULT '',
  logo_storage_path TEXT NOT NULL DEFAULT '',
  signature_storage_path TEXT NOT NULL DEFAULT '',
  defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  catalog JSONB NOT NULL DEFAULT '[]'::jsonb,
  ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- 3. Invoices Table (Documents, Claims, Line Items, Payment Ledger, Retainers)
CREATE TABLE IF NOT EXISTS public.invoices (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL CHECK (id ~ '^[A-Za-z0-9_\-]{1,40}$'),
  number TEXT NOT NULL CHECK (length(number) BETWEEN 1 AND 40),
  title TEXT NOT NULL DEFAULT 'invoice' CHECK (
    title IN ('invoice', 'tax', 'quote', 'proforma', 'credit', 'receipt', 'voucher', 'po', 'statement', 'claim')
  ),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'paid', 'void')
  ),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  lang VARCHAR(5) NOT NULL DEFAULT 'en' CHECK (
    lang IN ('en', 'ar', 'ur', 'te')
  ),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  client_phone TEXT NOT NULL DEFAULT '',
  client_address TEXT NOT NULL DEFAULT '',
  client_state TEXT NOT NULL DEFAULT '',
  client_tax_id TEXT NOT NULL DEFAULT '',
  tax_mode TEXT NOT NULL DEFAULT 'exclusive' CHECK (tax_mode IN ('inclusive', 'exclusive')),
  tax_regime TEXT NOT NULL DEFAULT '' CHECK (tax_regime IN ('simple', 'gst_in', '')),
  supplier_state TEXT NOT NULL DEFAULT '',
  place_of_supply TEXT NOT NULL DEFAULT '',
  tax_rate NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  tax_label TEXT NOT NULL DEFAULT 'Tax',
  discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  rounding_mode TEXT NOT NULL DEFAULT 'none' CHECK (rounding_mode IN ('nearest_unit', 'none')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  payments JSONB NOT NULL DEFAULT '[]'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  recurring JSONB NOT NULL DEFAULT '{}'::jsonb,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  payment_instructions TEXT NOT NULL DEFAULT '',
  upi_id TEXT NOT NULL DEFAULT '',
  payment_link TEXT NOT NULL DEFAULT '',
  show_signature BOOLEAN NOT NULL DEFAULT FALSE,
  is_sample BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, id)
);

-- 3b. Invoice Tombstones (Permanent Deletion Prevention of Resurrection)
CREATE TABLE IF NOT EXISTS public.invoice_tombstones (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, invoice_id)
);

-- 4. Account Change Log (Prunable Delta Stream)
CREATE TABLE IF NOT EXISTS public.account_sync_log (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_seq BIGINT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice', 'user_profile')),
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  record_version INT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, change_seq)
);

-- 5. Synchronization Idempotency Log (With Payload Hash Check)
CREATE TABLE IF NOT EXISTS public.sync_idempotency_log (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  payload_hash TEXT NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, idempotency_key)
);

-- 6. Conflict Archive Vault (Server-Side Collision Preservation)
CREATE TABLE IF NOT EXISTS public.conflict_archive (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice', 'user_profile')),
  client_version INT NOT NULL,
  server_version INT NOT NULL,
  rejected_payload JSONB NOT NULL,
  server_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_active_sync 
  ON public.invoices (user_id, server_updated_at) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_client_search 
  ON public.invoices (user_id, client_name, client_email) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_account_sync_log_seq 
  ON public.account_sync_log (user_id, change_seq ASC);

CREATE INDEX IF NOT EXISTS idx_idempotency_created 
  ON public.sync_idempotency_log (created_at);

-- Row-Level Security
ALTER TABLE public.account_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_idempotency_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_archive ENABLE ROW LEVEL SECURITY;

-- Explicit RLS Read Policies (Writes are restricted strictly to RPCs)
CREATE POLICY "sync_state_select" ON public.account_sync_state
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "invoice_tombstones_select" ON public.invoice_tombstones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "conflict_archive_select" ON public.conflict_archive
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Least-Privilege Grants: Direct writes REVOKED from client roles
GRANT SELECT ON TABLE public.account_sync_state TO authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT SELECT ON TABLE public.invoices TO authenticated;
GRANT SELECT ON TABLE public.conflict_archive TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.account_sync_state FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.user_profiles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.invoices FROM authenticated, anon;
REVOKE ALL ON TABLE public.account_sync_log FROM authenticated, anon;
REVOKE ALL ON TABLE public.sync_idempotency_log FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.conflict_archive FROM authenticated, anon;

-- ============================================================================
-- 7. SYNCHRONIZATION RPCS (SECURITY DEFINER, EMPTY SEARCH_PATH)
-- ============================================================================

-- A. Invoice Mutation RPC
CREATE OR REPLACE FUNCTION public.sync_push_invoice_mutation(
  p_id TEXT,
  p_expected_version INT,
  p_action TEXT,
  p_payload JSONB,
  p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_lock_key BIGINT;
  v_current_version INT;
  v_deleted_at TIMESTAMPTZ;
  v_current_record JSONB;
  v_next_seq BIGINT;
  v_payload_hash TEXT;
  v_cached_result JSONB;
  v_cached_hash TEXT;
  v_title TEXT;
  v_status TEXT;
  v_currency TEXT;
  v_lang TEXT;
  v_tax_mode TEXT;
  v_tax_regime TEXT;
BEGIN
  -- 1. Identity Authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authenticated session required' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate p_id, p_action, and p_idempotency_key
  IF p_id IS NULL OR NOT (p_id ~ '^[A-Za-z0-9_\-]{1,40}$') THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'invalid_request',
      'error_code', 'INVALID_RECORD_ID',
      'details', 'Record ID must be alphanumeric/dashes, 1-40 characters'
    );
  END IF;

  IF p_action NOT IN ('create', 'update', 'delete') THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'invalid_request',
      'error_code', 'INVALID_ACTION',
      'details', 'Action must be create, update, or delete'
    );
  END IF;

  IF p_idempotency_key IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'invalid_request',
      'error_code', 'MISSING_IDEMPOTENCY_KEY',
      'details', 'Valid UUID idempotency key is required'
    );
  END IF;

  -- 3. Compute 64-bit Transaction Lock Key (Derived from UUID bits 1-16)
  v_lock_key := ('x' || pg_catalog.substr(pg_catalog.replace(v_user_id::text, '-', ''), 1, 16))::bit(64)::bigint;
  PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);

  -- 4. Payload Hash & Idempotency Evaluation
  v_payload_hash := pg_catalog.encode(extensions.digest((p_action || ':' || p_id || ':' || COALESCE(p_expected_version::text, 'null') || ':' || COALESCE(p_payload::text, 'null'))::bytea, 'sha256'), 'hex');

  SELECT payload_hash, response_payload INTO v_cached_hash, v_cached_result
  FROM public.sync_idempotency_log
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;

  IF v_cached_result IS NOT NULL THEN
    IF v_cached_hash != v_payload_hash THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'invalid_request',
        'error_code', 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        'details', 'Idempotency key was previously submitted with a different payload'
      );
    END IF;
    RETURN v_cached_result;
  END IF;

  -- 5. Guarantee Permanent Sequence Head Exists
  INSERT INTO public.account_sync_state (user_id, current_change_seq, tombstone_clean_seq, tombstone_clean_at)
  VALUES (v_user_id, 0, 0, pg_catalog.now())
  ON CONFLICT (user_id) DO NOTHING;

  -- 6. Inspect Target Record State
  SELECT version, deleted_at, to_jsonb(invoices)
  INTO v_current_version, v_deleted_at, v_current_record
  FROM public.invoices
  WHERE user_id = v_user_id AND id = p_id
  FOR UPDATE;

  -- 7. Precondition Enforcement by Action
  IF p_action = 'create' THEN
    IF EXISTS (SELECT 1 FROM public.invoice_tombstones WHERE user_id = v_user_id AND invoice_id = p_id) THEN
      RETURN pg_catalog.jsonb_build_object('status', 'already_deleted', 'id', p_id);
    END IF;

    IF p_expected_version IS NOT NULL AND p_expected_version != 0 THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'invalid_request',
        'error_code', 'INVALID_CREATE_VERSION',
        'details', 'Expected version for create must be NULL or 0'
      );
    END IF;

    IF v_current_record IS NOT NULL THEN
      IF v_deleted_at IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'status', 'already_deleted',
          'record_id', p_id,
          'server_version', v_current_version
        );
      ELSE
        RETURN pg_catalog.jsonb_build_object(
          'status', 'conflict',
          'record_id', p_id,
          'expected_version', 0,
          'server_version', v_current_version,
          'server_record', v_current_record
        );
      END IF;
    END IF;

  ELSIF p_action = 'update' THEN
    IF p_expected_version IS NULL OR p_expected_version < 1 THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'invalid_request',
        'error_code', 'INVALID_EXPECTED_VERSION',
        'details', 'Expected version for update must be a positive integer'
      );
    END IF;

    IF v_current_record IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'not_found',
        'record_id', p_id
      );
    END IF;

    IF v_deleted_at IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'already_deleted',
        'record_id', p_id,
        'server_version', v_current_version
      );
    END IF;

    IF v_current_version != p_expected_version THEN
      INSERT INTO public.conflict_archive (
        user_id, record_id, entity_type, client_version, server_version, rejected_payload, server_payload
      ) VALUES (
        v_user_id, p_id, 'invoice', p_expected_version, v_current_version, p_payload, v_current_record
      );

      v_cached_result := pg_catalog.jsonb_build_object(
        'status', 'conflict',
        'record_id', p_id,
        'expected_version', p_expected_version,
        'server_version', v_current_version,
        'server_record', v_current_record
      );
      INSERT INTO public.sync_idempotency_log (user_id, idempotency_key, payload_hash, response_payload)
      VALUES (v_user_id, p_idempotency_key, v_payload_hash, v_cached_result);
      RETURN v_cached_result;
    END IF;

  ELSIF p_action = 'delete' THEN
    IF p_expected_version IS NULL OR p_expected_version < 1 THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'invalid_request',
        'error_code', 'INVALID_EXPECTED_VERSION',
        'details', 'Expected version for delete must be a positive integer'
      );
    END IF;

    IF v_current_record IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'not_found',
        'record_id', p_id
      );
    END IF;

    IF v_deleted_at IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'already_deleted',
        'record_id', p_id,
        'server_version', v_current_version
      );
    END IF;

    IF v_current_version != p_expected_version THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'conflict',
        'record_id', p_id,
        'expected_version', p_expected_version,
        'server_version', v_current_version,
        'server_record', v_current_record
      );
    END IF;
  END IF;

  -- 8. Deep Payload Validation for create/update
  IF p_action IN ('create', 'update') THEN
    IF p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) != 'object' THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_PAYLOAD', 'details', 'Payload must be a JSON object');
    END IF;

    v_title := p_payload->>'title';
    IF v_title NOT IN ('invoice', 'tax', 'quote', 'proforma', 'credit', 'receipt', 'voucher', 'po', 'statement', 'claim') THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_TITLE', 'details', 'Title is unsupported');
    END IF;

    v_status := p_payload->>'status';
    IF v_status NOT IN ('draft', 'sent', 'paid', 'void') THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_STATUS', 'details', 'Status must be draft, sent, paid, or void');
    END IF;

    v_currency := p_payload->>'currency';
    IF v_currency IS NULL OR pg_catalog.length(v_currency) != 3 THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_CURRENCY', 'details', 'Currency must be 3-letter ISO code');
    END IF;

    v_lang := p_payload->>'lang';
    IF v_lang NOT IN ('en', 'ar', 'ur', 'te') THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_LANG', 'details', 'Language must be en, ar, ur, or te');
    END IF;

    v_tax_mode := p_payload->>'taxMode';
    IF v_tax_mode NOT IN ('inclusive', 'exclusive') THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_TAX_MODE', 'details', 'Tax mode must be inclusive or exclusive');
    END IF;

    v_tax_regime := COALESCE(p_payload->>'taxRegime', '');
    IF v_tax_regime NOT IN ('simple', 'gst_in', '') THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_TAX_REGIME', 'details', 'Tax regime must be simple, gst_in, or empty');
    END IF;

    IF p_payload->>'issue' IS NULL OR NOT (p_payload->>'issue' ~ '^\d{4}-\d{2}-\d{2}$') THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_ISSUE_DATE', 'details', 'Issue date must be YYYY-MM-DD');
    END IF;

    IF p_payload->>'due' IS NULL OR NOT (p_payload->>'due' ~ '^\d{4}-\d{2}-\d{2}$') THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_DUE_DATE', 'details', 'Due date must be YYYY-MM-DD');
    END IF;

    IF pg_catalog.jsonb_typeof(COALESCE(p_payload->'items', '[]'::jsonb)) != 'array' THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_ITEMS', 'details', 'Items must be a JSON array');
    END IF;

    IF pg_catalog.jsonb_typeof(COALESCE(p_payload->'payments', '[]'::jsonb)) != 'array' THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_PAYMENTS', 'details', 'Payments must be a JSON array');
    END IF;
  END IF;

  -- 9. Advance Sequence Head
  UPDATE public.account_sync_state
  SET current_change_seq = current_change_seq + 1,
      updated_at = pg_catalog.now()
  WHERE user_id = v_user_id
  RETURNING current_change_seq INTO v_next_seq;

  -- 10. Execute Mutation
  IF p_action = 'delete' THEN
    UPDATE public.invoices
    SET deleted_at = pg_catalog.now(),
        version = version + 1,
        server_updated_at = pg_catalog.now()
    WHERE user_id = v_user_id AND id = p_id
    RETURNING version INTO v_current_version;

    INSERT INTO public.invoice_tombstones (user_id, invoice_id, deleted_at)
    VALUES (v_user_id, p_id, pg_catalog.now())
    ON CONFLICT (user_id, invoice_id) DO UPDATE SET deleted_at = pg_catalog.now();

    INSERT INTO public.account_sync_log (user_id, change_seq, entity_type, record_id, operation, record_version, payload)
    VALUES (v_user_id, v_next_seq, 'invoice', p_id, 'delete', v_current_version, NULL);

  ELSIF p_action = 'create' THEN
    v_current_version := 1;
    INSERT INTO public.invoices (
      user_id, id, number, title, status, currency, lang, issue_date, due_date, paid_date,
      client_name, client_email, client_phone, client_address, client_state, client_tax_id,
      tax_mode, tax_regime, supplier_state, place_of_supply, tax_rate, tax_label, discount_type,
      discount, rounding_mode, items, payments, history, recurring, extra, notes, payment_instructions,
      upi_id, payment_link, show_signature, is_sample, created_at_ms, updated_at_ms, version,
      server_updated_at
    ) VALUES (
      v_user_id, p_id,
      p_payload->>'number', v_title, v_status, v_currency, v_lang,
      (p_payload->>'issue')::date, (p_payload->>'due')::date, NULLIF(p_payload->>'paidDate','')::date,
      COALESCE(p_payload->'client'->>'name', ''), COALESCE(p_payload->'client'->>'email', ''),
      COALESCE(p_payload->'client'->>'phone', ''), COALESCE(p_payload->'client'->>'address', ''),
      COALESCE(p_payload->'client'->>'state', ''), COALESCE(p_payload->'client'->>'taxId', ''),
      v_tax_mode, v_tax_regime, COALESCE(p_payload->>'supplierState', ''), COALESCE(p_payload->>'placeOfSupply', ''),
      COALESCE((p_payload->>'taxRate')::numeric, 0.00), COALESCE(p_payload->>'taxLabel', 'Tax'),
      COALESCE(p_payload->>'discountType', 'percent'), COALESCE((p_payload->>'discount')::numeric, 0.00),
      COALESCE(p_payload->>'roundingMode', 'none'), COALESCE(p_payload->'items', '[]'::jsonb),
      COALESCE(p_payload->'payments', '[]'::jsonb), COALESCE(p_payload->'history', '[]'::jsonb),
      COALESCE(p_payload->'recurring', '{}'::jsonb),
      COALESCE(p_payload->'extra', pg_catalog.jsonb_build_object('po', COALESCE(p_payload->>'po',''), 'signature', COALESCE(p_payload->>'signature',''), 'recurring', COALESCE(p_payload->'recurring', '{}'::jsonb))),
      COALESCE(p_payload->>'notes', ''),
      COALESCE(p_payload->>'payment', ''), COALESCE(p_payload->>'upiId', ''), COALESCE(p_payload->>'paymentLink', ''),
      COALESCE((p_payload->>'showSignature')::boolean, false), COALESCE((p_payload->>'sample')::boolean, false),
      COALESCE((p_payload->>'created')::bigint, (pg_catalog.extract(epoch from pg_catalog.now()) * 1000)::bigint),
      COALESCE((p_payload->>'updated')::bigint, (pg_catalog.extract(epoch from pg_catalog.now()) * 1000)::bigint),
      v_current_version, pg_catalog.now()
    )
    RETURNING to_jsonb(invoices) INTO v_current_record;

    INSERT INTO public.account_sync_log (user_id, change_seq, entity_type, record_id, operation, record_version, payload)
    VALUES (v_user_id, v_next_seq, 'invoice', p_id, 'insert', v_current_version, v_current_record);

  ELSIF p_action = 'update' THEN
    UPDATE public.invoices SET
      number = p_payload->>'number', title = v_title, status = v_status, currency = v_currency,
      lang = v_lang, issue_date = (p_payload->>'issue')::date, due_date = (p_payload->>'due')::date,
      paid_date = NULLIF(p_payload->>'paidDate','')::date, client_name = COALESCE(p_payload->'client'->>'name', ''),
      client_email = COALESCE(p_payload->'client'->>'email', ''), client_phone = COALESCE(p_payload->'client'->>'phone', ''),
      client_address = COALESCE(p_payload->'client'->>'address', ''), client_state = COALESCE(p_payload->'client'->>'state', ''),
      client_tax_id = COALESCE(p_payload->'client'->>'taxId', ''), tax_mode = v_tax_mode, tax_regime = v_tax_regime,
      supplier_state = COALESCE(p_payload->>'supplierState', ''), place_of_supply = COALESCE(p_payload->>'placeOfSupply', ''),
      tax_rate = COALESCE((p_payload->>'taxRate')::numeric, 0.00), tax_label = COALESCE(p_payload->>'taxLabel', 'Tax'),
      discount_type = COALESCE(p_payload->>'discountType', 'percent'), discount = COALESCE((p_payload->>'discount')::numeric, 0.00),
      rounding_mode = COALESCE(p_payload->>'roundingMode', 'none'), items = COALESCE(p_payload->'items', '[]'::jsonb),
      payments = COALESCE(p_payload->'payments', '[]'::jsonb), history = COALESCE(p_payload->'history', '[]'::jsonb),
      recurring = COALESCE(p_payload->'recurring', '{}'::jsonb),
      extra = COALESCE(p_payload->'extra', pg_catalog.jsonb_build_object('po', COALESCE(p_payload->>'po',''), 'signature', COALESCE(p_payload->>'signature',''), 'recurring', COALESCE(p_payload->'recurring', '{}'::jsonb))),
      notes = COALESCE(p_payload->>'notes', ''),
      payment_instructions = COALESCE(p_payload->>'payment', ''), upi_id = COALESCE(p_payload->>'upiId', ''),
      payment_link = COALESCE(p_payload->>'paymentLink', ''), show_signature = COALESCE((p_payload->>'showSignature')::boolean, false),
      updated_at_ms = COALESCE((p_payload->>'updated')::bigint, (pg_catalog.extract(epoch from pg_catalog.now()) * 1000)::bigint),
      version = invoices.version + 1,
      deleted_at = NULL,
      server_updated_at = pg_catalog.now()
    WHERE user_id = v_user_id AND id = p_id
    RETURNING version, to_jsonb(invoices) INTO v_current_version, v_current_record;

    INSERT INTO public.account_sync_log (user_id, change_seq, entity_type, record_id, operation, record_version, payload)
    VALUES (v_user_id, v_next_seq, 'invoice', p_id, 'update', v_current_version, v_current_record);
  END IF;

  -- 11. Cache Response in Idempotency Log
  v_cached_result := pg_catalog.jsonb_build_object(
    'status', 'success',
    'record_id', p_id,
    'committed_version', v_current_version,
    'change_seq', v_next_seq
  );

  INSERT INTO public.sync_idempotency_log (user_id, idempotency_key, payload_hash, response_payload)
  VALUES (v_user_id, p_idempotency_key, v_payload_hash, v_cached_result);

  RETURN v_cached_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- B. Profile Mutation RPC
CREATE OR REPLACE FUNCTION public.sync_push_profile_mutation(
  p_expected_version INT,
  p_payload JSONB,
  p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_lock_key BIGINT;
  v_current_version INT;
  v_current_record JSONB;
  v_next_seq BIGINT;
  v_payload_hash TEXT;
  v_cached_result JSONB;
  v_cached_hash TEXT;
  v_tax_regime TEXT;
BEGIN
  -- 1. Identity Verification
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authenticated session required' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'MISSING_IDEMPOTENCY_KEY', 'details', 'Valid UUID idempotency key is required');
  END IF;

  -- 2. Validate Payload
  IF p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) != 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_PAYLOAD', 'details', 'Payload must be a JSON object');
  END IF;

  v_tax_regime := COALESCE(p_payload->>'tax_regime', 'simple');
  IF v_tax_regime NOT IN ('simple', 'gst_in') THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_TAX_REGIME', 'details', 'Tax regime must be simple or gst_in');
  END IF;

  IF pg_catalog.jsonb_typeof(COALESCE(p_payload->'defaults', '{}'::jsonb)) != 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_DEFAULTS', 'details', 'Defaults must be a JSON object');
  END IF;

  IF pg_catalog.jsonb_typeof(COALESCE(p_payload->'catalog', '[]'::jsonb)) != 'array' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_CATALOG', 'details', 'Catalog must be a JSON array');
  END IF;

  -- 3. 64-bit Advisory Lock
  v_lock_key := ('x' || pg_catalog.substr(pg_catalog.replace(v_user_id::text, '-', ''), 1, 16))::bit(64)::bigint;
  PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);

  -- 4. SHA-256 Digest Idempotency Check
  v_payload_hash := pg_catalog.encode(extensions.digest(('profile_upsert:' || COALESCE(p_expected_version::text, 'null') || ':' || COALESCE(p_payload::text, 'null'))::bytea, 'sha256'), 'hex');

  SELECT payload_hash, response_payload INTO v_cached_hash, v_cached_result
  FROM public.sync_idempotency_log
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;

  IF v_cached_result IS NOT NULL THEN
    IF v_cached_hash != v_payload_hash THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'details', 'Idempotency key reused with different payload');
    END IF;
    RETURN v_cached_result;
  END IF;

  -- 5. Row Lock & Version Inspection
  SELECT version, to_jsonb(user_profiles)
  INTO v_current_version, v_current_record
  FROM public.user_profiles
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- 6. Initial Creation vs Update Concurrency
  IF v_current_record IS NULL THEN
    IF p_expected_version IS NOT NULL AND p_expected_version != 0 THEN
      RETURN pg_catalog.jsonb_build_object('status', 'invalid_request', 'error_code', 'INVALID_INITIAL_VERSION', 'details', 'Initial profile creation requires expected_version 0 or NULL');
    END IF;
    v_current_version := 1;
  ELSE
    IF p_expected_version IS NULL OR v_current_version != p_expected_version THEN
      INSERT INTO public.conflict_archive (
        user_id, record_id, entity_type, client_version, server_version, rejected_payload, server_payload
      ) VALUES (
        v_user_id, 'profile', 'user_profile', COALESCE(p_expected_version, 0), v_current_version, p_payload, v_current_record
      );

      v_cached_result := pg_catalog.jsonb_build_object(
        'status', 'conflict',
        'expected_version', p_expected_version,
        'server_version', v_current_version,
        'server_record', v_current_record
      );
      INSERT INTO public.sync_idempotency_log (user_id, idempotency_key, payload_hash, response_payload)
      VALUES (v_user_id, p_idempotency_key, v_payload_hash, v_cached_result);
      RETURN v_cached_result;
    END IF;
    v_current_version := v_current_version + 1;
  END IF;

  -- 7. Advance Sequence Head
  INSERT INTO public.account_sync_state (user_id, current_change_seq, tombstone_clean_seq, tombstone_clean_at)
  VALUES (v_user_id, 1, 0, pg_catalog.now())
  ON CONFLICT (user_id) DO UPDATE SET
    current_change_seq = public.account_sync_state.current_change_seq + 1,
    updated_at = pg_catalog.now()
  RETURNING current_change_seq INTO v_next_seq;

  -- 8. Upsert Profile
  INSERT INTO public.user_profiles (
    user_id, business_name, business_address, business_state, business_email, business_phone,
    tax_id_label, tax_id, tax_regime, upi_id, payment_link, zatca_enabled, email_webhook,
    logo_storage_path, signature_storage_path, defaults, catalog, ui_preferences, version,
    server_updated_at
  ) VALUES (
    v_user_id,
    COALESCE(p_payload->>'business_name', ''), COALESCE(p_payload->>'business_address', ''),
    COALESCE(p_payload->>'business_state', ''), COALESCE(p_payload->>'business_email', ''),
    COALESCE(p_payload->>'business_phone', ''), COALESCE(p_payload->>'tax_id_label', 'Tax ID'),
    COALESCE(p_payload->>'tax_id', ''), v_tax_regime, COALESCE(p_payload->>'upiId', ''),
    COALESCE(p_payload->>'payment_link', ''), COALESCE((p_payload->>'zatca_enabled')::boolean, false),
    COALESCE(p_payload->>'email_webhook', ''), COALESCE(p_payload->>'logo_storage_path', ''),
    COALESCE(p_payload->>'signature_storage_path', ''), COALESCE(p_payload->'defaults', '{}'::jsonb),
    COALESCE(p_payload->'catalog', '[]'::jsonb), COALESCE(p_payload->'ui_preferences', '{}'::jsonb),
    v_current_version, pg_catalog.now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name, business_address = EXCLUDED.business_address,
    business_state = EXCLUDED.business_state, business_email = EXCLUDED.business_email,
    business_phone = EXCLUDED.business_phone, tax_id_label = EXCLUDED.tax_id_label,
    tax_id = EXCLUDED.tax_id, tax_regime = EXCLUDED.tax_regime, upi_id = EXCLUDED.upi_id,
    payment_link = EXCLUDED.payment_link, zatca_enabled = EXCLUDED.zatca_enabled,
    email_webhook = EXCLUDED.email_webhook, logo_storage_path = EXCLUDED.logo_storage_path,
    signature_storage_path = EXCLUDED.signature_storage_path, defaults = EXCLUDED.defaults,
    catalog = EXCLUDED.catalog, ui_preferences = EXCLUDED.ui_preferences,
    version = v_current_version, server_updated_at = pg_catalog.now()
  RETURNING to_jsonb(user_profiles) INTO v_current_record;

  -- 9. Change Log Entry
  INSERT INTO public.account_sync_log (
    user_id, change_seq, entity_type, record_id, operation, record_version, payload
  ) VALUES (
    v_user_id, v_next_seq, 'user_profile', 'profile', 'update', v_current_version, v_current_record
  );

  v_cached_result := pg_catalog.jsonb_build_object(
    'status', 'success',
    'committed_version', v_current_version,
    'change_seq', v_next_seq
  );

  INSERT INTO public.sync_idempotency_log (user_id, idempotency_key, payload_hash, response_payload)
  VALUES (v_user_id, p_idempotency_key, v_payload_hash, v_cached_result);

  RETURN v_cached_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- C. Delta Pull RPC
CREATE OR REPLACE FUNCTION public.sync_pull_changes(
  p_since_seq BIGINT,
  p_limit INT DEFAULT 100
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_head_seq BIGINT;
  v_clean_seq BIGINT;
  v_changes JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT current_change_seq, tombstone_clean_seq
  INTO v_head_seq, v_clean_seq
  FROM public.account_sync_state
  WHERE user_id = v_user_id;

  IF v_head_seq IS NULL THEN
    INSERT INTO public.account_sync_state (user_id, current_change_seq, tombstone_clean_seq, tombstone_clean_at)
    VALUES (v_user_id, 0, 0, pg_catalog.now())
    RETURNING current_change_seq, tombstone_clean_seq INTO v_head_seq, v_clean_seq;
  END IF;

  IF p_since_seq < v_clean_seq THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'reconciliation_required',
      'clean_watermark', v_clean_seq,
      'head_seq', v_head_seq
    );
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(to_jsonb(l)), '[]'::jsonb)
  INTO v_changes
  FROM (
    SELECT change_seq, entity_type, record_id, operation, record_version, payload, created_at
    FROM public.account_sync_log
    WHERE user_id = v_user_id
      AND change_seq > p_since_seq
      AND change_seq <= v_head_seq
    ORDER BY change_seq ASC
    LIMIT pg_catalog.least(p_limit, 200)
  ) l;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'success',
    'head_seq', v_head_seq,
    'changes', v_changes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- D. Full Workspace Export RPC
CREATE OR REPLACE FUNCTION public.export_user_workspace()
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_head_seq BIGINT;
  v_profile JSONB;
  v_invoices JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT current_change_seq INTO v_head_seq
  FROM public.account_sync_state
  WHERE user_id = v_user_id;

  SELECT to_jsonb(user_profiles) INTO v_profile
  FROM public.user_profiles
  WHERE user_id = v_user_id;

  SELECT COALESCE(pg_catalog.jsonb_agg(to_jsonb(invoices)), '[]'::jsonb)
  INTO v_invoices
  FROM public.invoices
  WHERE user_id = v_user_id AND deleted_at IS NULL;

  RETURN pg_catalog.jsonb_build_object(
    'head_seq', COALESCE(v_head_seq, 0),
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'invoices', COALESCE(v_invoices, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- E. Tombstone Retention Purge Job
CREATE OR REPLACE FUNCTION public.purge_expired_tombstones(p_retention_days INT DEFAULT 90)
RETURNS VOID AS $$
DECLARE
  v_user_rec RECORD;
  v_lock_key BIGINT;
  v_purge_boundary TIMESTAMPTZ;
  v_max_purged_seq BIGINT;
BEGIN
  v_purge_boundary := pg_catalog.now() - (p_retention_days || ' days')::interval;

  FOR v_user_rec IN SELECT user_id FROM public.account_sync_state LOOP
    v_lock_key := ('x' || pg_catalog.substr(pg_catalog.replace(v_user_rec.user_id::text, '-', ''), 1, 16))::bit(64)::bigint;
    PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);

    SELECT COALESCE(pg_catalog.max(change_seq), 0) INTO v_max_purged_seq
    FROM public.account_sync_log
    WHERE user_id = v_user_rec.user_id AND created_at < v_purge_boundary;

    IF v_max_purged_seq > 0 THEN
      UPDATE public.account_sync_state
      SET tombstone_clean_seq = pg_catalog.greatest(tombstone_clean_seq, v_max_purged_seq),
          tombstone_clean_at = pg_catalog.now()
      WHERE user_id = v_user_rec.user_id;

      DELETE FROM public.account_sync_log
      WHERE user_id = v_user_rec.user_id AND change_seq <= v_max_purged_seq;

      DELETE FROM public.invoices
      WHERE user_id = v_user_rec.user_id AND deleted_at IS NOT NULL AND deleted_at < v_purge_boundary;

      DELETE FROM public.invoice_tombstones
      WHERE user_id = v_user_rec.user_id AND deleted_at < v_purge_boundary;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execution of authorized synchronization RPCs exclusively to authenticated users
GRANT EXECUTE ON FUNCTION public.sync_push_invoice_mutation TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_push_profile_mutation TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_pull_changes TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_user_workspace TO authenticated;
