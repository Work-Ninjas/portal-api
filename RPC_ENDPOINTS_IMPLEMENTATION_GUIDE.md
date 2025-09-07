# 📋 Documentación Completa: Implementación de Endpoints RPC

## 🎯 Arquitectura RPC Correcta

### Patrón de Implementación
Los endpoints deben seguir la arquitectura **RPC-first, API-second**:

1. **Base de Datos**: Crear función RPC con `SECURITY DEFINER`
2. **Servicio**: Usar `db.supabase.rpc()` directamente (NO abstracciones)
3. **Route**: Importar servicio RPC y manejar errores
4. **Deploy**: Build → ACR → Container App revision

## 🗄️ 1. Creación de RPC Functions en Base de Datos

### Template de RPC Function
```sql
CREATE OR REPLACE FUNCTION api_[endpoint_name](
    p_client_id UUID,
    p_limit INTEGER DEFAULT 25,
    p_offset INTEGER DEFAULT 0,
    -- parámetros específicos
)
RETURNS TABLE (
    -- campos de retorno
    id UUID,
    -- otros campos...
) 
LANGUAGE plpgsql
SECURITY DEFINER  -- ¡CRÍTICO para permisos!
AS $$
BEGIN
    -- 1. Resolución de tenant
    DECLARE
        v_tenant_id UUID;
    BEGIN
        SELECT tenant_id INTO v_tenant_id 
        FROM api_key 
        WHERE client_id = p_client_id AND is_active = true;
        
        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Invalid or inactive client_id';
        END IF;
    END;

    -- 2. Query principal con filtro de tenant
    RETURN QUERY
    SELECT 
        t.id,
        -- campos...
    FROM [tabla] t
    WHERE t.tenant_id = v_tenant_id
        -- filtros adicionales
    ORDER BY [campo] [dirección]
    LIMIT p_limit OFFSET p_offset;
END;
$$;
```

### Ejemplos Reales Exitosos
- `api_list_contacts`: Lista contactos con tenant isolation
- `api_list_jobs`: Lista jobs con filtros de estado y búsqueda
- `api_list_job_files`: Lista archivos por job con validación de acceso

## 🔧 2. Implementación de Servicios RPC

### Template de Servicio
```typescript
// src/services/[endpoint]-rpc.ts
import { [Type], PaginationResponse } from '../types';
import { getDatabase } from './database';
import { logger } from '../utils/logger';

export class [Endpoint]Service {
  constructor() {}

  async [method](params: {
    // parámetros de entrada
    limit: number;
    offset: number;
    traceId: string;
    clientId: string;
  }): Promise<PaginationResponse & { data: [Type][] }> {
    
    logger.info('RPC call', {
      endpoint: '/v1/[endpoint]',
      client_id: params.clientId,
      rpc: 'api_[function_name]',
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // ✅ LLAMADA RPC DIRECTA (no abstracciones)
      const { data: rawData, error } = await db.supabase.rpc('api_[function_name]', {
        p_client_id: params.clientId,
        p_limit: params.limit,
        p_offset: params.offset,
        // otros parámetros...
      });

      if (error) {
        logger.error('RPC error calling api_[function_name]', {
          error: error.message,
          client_id: params.clientId,
          traceId: params.traceId
        });
        throw new Error(`RPC error: ${error.message}`);
      }

      // ✅ MAPEO DE RESPUESTA (passthrough approach)
      const mappedData = (rawData || []).map((record: any) => this.mapRpcToApi(record));

      // ✅ CONTEO TOTAL (segunda llamada RPC para paginación)
      const { data: countData, error: countError } = await db.supabase.rpc('api_[function_name]', {
        p_client_id: params.clientId,
        p_limit: 10000, // Large limit to get total
        p_offset: 0
      });

      let total = 0;
      if (!countError && countData) {
        total = countData.length;
      }

      const hasMore = params.offset + params.limit < total;

      return {
        data: mappedData,
        total,
        limit: params.limit,
        offset: params.offset,
        has_more: hasMore
      };

    } catch (error) {
      logger.error('[Service].[method] RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        traceId: params.traceId
      });
      throw error;
    }
  }

  private mapRpcToApi(record: any): [Type] {
    // ✅ MAPEO PASSTHROUGH con extensiones como 'any' si es necesario
    const mapped: [Type] = {
      id: record.id,
      // mapear campos requeridos...
    };

    // Para campos extra no definidos en el tipo
    const extended = mapped as any;
    if (record.extra_field) {
      extended.extra_field = record.extra_field;
    }

    return extended;
  }
}
```

### ⚠️ Puntos Críticos
- **NO usar RpcClient** o abstracciones
- **SÍ usar** `db.supabase.rpc()` directamente
- **Mapeo passthrough**: Incluir todos los campos de RPC
- **Logging completo**: Para debugging
- **Manejo de tipos**: Usar `as any` para campos extendidos

## 🛣️ 3. Implementación de Routes

### Template de Route
```typescript
// src/routes/[endpoint]-real.ts
import { Router, Request, Response } from 'express';
import authMiddleware from '../middleware/auth';
import { ApiError, ErrorCodes } from '../utils/errors';
import { [Endpoint]Service } from '../services/[endpoint]-rpc';

const router = Router();
const [endpoint]Service = new [Endpoint]Service();

router.get('/[endpoint]', authMiddleware, async (req: Request, res: Response) => {
  // ✅ PARSEO Y VALIDACIÓN DE PARÁMETROS
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  
  // Validaciones específicas...
  if (limit < 1) {
    throw new ApiError(400, ErrorCodes.BAD_REQUEST, 'Limit must be greater than 0');
  }

  try {
    const result = await [endpoint]Service.[method]({
      limit,
      offset,
      traceId: req.traceId,
      clientId: req.clientId!
    });

    res.status(200).json(result);
  } catch (error) {
    // ✅ MANEJO DE ERRORES ESPECÍFICOS
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new ApiError(404, ErrorCodes.NOT_FOUND, 'Resource not found');
      }
    }
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve data');
  }
});

export default router;
```

### ⚠️ Validaciones Importantes
- **Job IDs**: Usar UUID format `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- **NO usar** formatos como `^job_[a-z0-9]{8}$`
- **Límites**: Max 100, default 25
- **Offsets**: >= 0

## 🔐 4. Signed URLs para Storage (Files)

### Implementación de Supabase Storage
```typescript
// Para endpoints que manejan archivos
private async mapRpcToApiFile(record: any): Promise<FileAsset> {
  const fileAsset: FileAsset = {
    id: record.id,
    name: record.filename || 'Unknown File',
    // otros campos...
  };

  // ✅ SIGNED URLs REALES (no placeholders)
  if (record.object_path) {
    try {
      const db = getDatabase();
      
      // Generar signed URL con 1 hora de expiración
      const { data: signedUrlData, error: urlError } = await db.supabase.storage
        .from('assets')
        .createSignedUrl(record.object_path, 3600);

      if (!urlError && signedUrlData?.signedUrl) {
        fileAsset.signed_url = signedUrlData.signedUrl;
        fileAsset.expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      } else {
        fileAsset.signed_url = '';
        fileAsset.expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      }
    } catch (error) {
      fileAsset.signed_url = '';
      fileAsset.expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }
  }

  return fileAsset;
}
```

## 🚀 5. Proceso de Deploy

### 1. Build Local
```bash
cd D:\portal-api
npm run build  # Verificar que compila sin errores
```

### 2. Build en Azure Container Registry
```bash
cd D:\portal-api
az acr build --registry portalapiacr --image portalapi:[feature]-$(date +%Y%m%d-%H%M%S) .
```

### 3. Verificar Build
```bash
az acr task list-runs --registry portalapiacr --top 1 --output table
```

### 4. Deploy a Container App
```bash
az containerapp revision copy \
  --name portal-api-prod \
  --resource-group rg-data-migration-portal-prod \
  --image portalapiacr.azurecr.io/portalapi:[tag] \
  --revision-suffix [feature]-$(date +%Y%m%d-%H%M%S)
```

### 5. Verificar Deploy
```bash
# Esperar ~30 segundos para estabilización
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/[endpoint]"
```

## 🐛 6. Problemas Comunes y Soluciones

### ❌ Error: Missing RPC Functions
**Problema**: `function api_[name] does not exist`
**Solución**: Crear la función RPC en la base de datos primero

### ❌ Error: TypeScript Compilation
**Problema**: `Property 'field' is missing in type`
**Solución**: 
```typescript
// Usar type assertion para campos extendidos
const extended = baseObject as any;
extended.extraField = record.extraField;
```

### ❌ Error: Invalid job ID format
**Problema**: Validación incorrecta de UUID
**Solución**: Usar regex UUID completo, no formatos custom

### ❌ Error: Placeholder signed URLs
**Problema**: URLs de ejemplo en lugar de reales
**Solución**: Implementar `supabase.storage.createSignedUrl()`

### ❌ Error: Docker build timeout
**Problema**: Build se cuelga en ACR
**Solución**: Aumentar timeout o reintentar con diferente tag

### ❌ Error: 502 Bad Gateway
**Problema**: Endpoint no responde después del deploy
**Solución**: Esperar 30+ segundos para estabilización del contenedor

## 🔑 7. Recursos de Desarrollo

### Environment
- **API Key**: `dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG`
- **Base URL**: `https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io`
- **ACR**: `portalapiacr.azurecr.io`
- **Container App**: `portal-api-prod` en `rg-data-migration-portal-prod`

### Endpoints Funcionando
- ✅ `/v1/contacts` - 109 contactos
- ✅ `/v1/jobs` - 110 jobs  
- ✅ `/v1/jobs/{jobId}/files` - Archivos con signed URLs reales

## 📋 8. Checklist para Nuevos Endpoints

### Pre-implementación
- [ ] Definir estructura de tabla/datos
- [ ] Identificar parámetros de filtrado necesarios
- [ ] Revisar tipos TypeScript existentes

### Implementación
- [ ] Crear RPC function con `SECURITY DEFINER`
- [ ] Implementar servicio RPC con `db.supabase.rpc()`
- [ ] Crear route con validaciones apropiadas
- [ ] Manejar signed URLs si aplica

### Testing & Deploy
- [ ] `npm run build` sin errores
- [ ] Build en ACR exitoso
- [ ] Deploy a Container App
- [ ] Test con API key real
- [ ] Verificar paginación y filtros

### Post-deploy
- [ ] Documentar endpoint en OpenAPI
- [ ] Actualizar todo list si se usa TodoWrite
- [ ] Verificar logs de Application Insights

---

**Creado**: 2025-09-06  
**Última actualización**: 2025-09-06  
**Estado**: ✅ Implementación exitosa de contacts, jobs, y files endpoints