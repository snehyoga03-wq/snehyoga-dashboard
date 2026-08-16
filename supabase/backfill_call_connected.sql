ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS call_connected text;

UPDATE public.leads
SET call_connected = 'not_connected'
WHERE remark IS NOT NULL
  AND remark != ''
  AND (
    lower(remark) LIKE '%call not received%'
    OR lower(remark) LIKE '%call not picked%'
    OR lower(remark) LIKE '%not received%'
    OR lower(remark) LIKE '%not picked%'
    OR lower(remark) LIKE '%not reachable%'
    OR lower(remark) LIKE '%unreachable%'
    OR lower(remark) LIKE '%switched off%'
    OR lower(remark) LIKE '%switch off%'
    OR lower(remark) LIKE '%out of coverage%'
    OR lower(remark) LIKE '%busy%'
    OR lower(remark) LIKE '%no response%'
    OR lower(remark) LIKE '%no answer%'
    OR lower(remark) LIKE '%no ans%'
    OR lower(remark) LIKE '%not ans%'
    OR lower(remark) LIKE '%didn''t pick%'
    OR lower(remark) LIKE '%did not pick%'
    OR lower(remark) LIKE '%didn''t answer%'
    OR lower(remark) LIKE '%did not answer%'
    OR lower(remark) LIKE '%not responding%'
    OR lower(remark) LIKE '%phone off%'
    OR lower(remark) LIKE '%number not working%'
    OR lower(remark) LIKE '%invalid number%'
    OR lower(remark) LIKE '%wrong number%'
    OR lower(remark) LIKE '%disconnected%'
    OR lower(remark) LIKE '%network issue%'
    OR lower(remark) LIKE '%network error%'
    OR lower(remark) LIKE '%not available%'
    OR lower(remark) LIKE '%unavailable%'
    OR lower(remark) LIKE '%ring no reply%'
    OR lower(remark) LIKE '%call not connected%'
    OR lower(remark) LIKE '%couldn''t connect%'
    OR lower(remark) LIKE '%could not connect%'
    OR lower(remark) LIKE '%can''t reach%'
    OR lower(remark) LIKE '%cannot reach%'
    OR lower(remark) = 'rnr'
    OR lower(remark) = 'np'
    OR lower(remark) = 'cnr'
    OR lower(remark) = 'snr'
  );

UPDATE public.leads
SET call_connected = 'connected'
WHERE remark IS NOT NULL
  AND remark != ''
  AND remark != 'No remark'
  AND call_connected IS NULL;
