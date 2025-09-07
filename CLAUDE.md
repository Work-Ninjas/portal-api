# CLAUDE.md - Portal API Implementation Guide

Este archivo proporciona orientación a Claude Code cuando trabaje con el código de este repositorio.

## 📋 Guía de Implementación de Endpoints RPC

**⚠️ IMPORTANTE**: Antes de implementar cualquier nuevo endpoint, consultar la guía completa:

👉 **[RPC_ENDPOINTS_IMPLEMENTATION_GUIDE.md](./RPC_ENDPOINTS_IMPLEMENTATION_GUIDE.md)**

Esta guía contiene:
- ✅ Patrones de implementación correctos
- ✅ Templates de código probados 
- ✅ Proceso completo de deploy
- ✅ Soluciones a problemas comunes
- ✅ Checklist para nuevos endpoints

## 🎯 Arquitectura Actual

### Endpoints Funcionando (RPC-based)
- **Contacts**: `/v1/contacts` - ✅ 109 contactos
- **Jobs**: `/v1/jobs` - ✅ 110 trabajos
- **Files**: `/v1/jobs/{jobId}/files` - ✅ Archivos con signed URLs reales

### Patrón de Implementación
1. **RPC Function** en base de datos con `SECURITY DEFINER`
2. **Servicio RPC** usando `db.supabase.rpc()` directamente  
3. **Route** con validaciones y manejo de errores
4. **Deploy** via Azure Container Registry → Container App

## 🚀 Deploy Environment

- **API Key**: `dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG`
- **Base URL**: `https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io`
- **ACR**: `portalapiacr.azurecr.io`
- **Container App**: `portal-api-prod` en `rg-data-migration-portal-prod`

## ⚠️ Antes de Implementar Cualquier Endpoint

1. **LEE** la guía completa en `RPC_ENDPOINTS_IMPLEMENTATION_GUIDE.md`
2. **VERIFICA** que existe la RPC function en la base de datos
3. **SIGUE** los templates exactos de la guía
4. **TESTEA** localmente con `npm run build`
5. **DEPLOYA** siguiendo el proceso documentado

## 🐛 En Caso de Problemas

Todos los errores comunes y sus soluciones están documentados en la guía de implementación. NO intentes resolver problemas sin consultarla primero.

---
**Última actualización**: 2025-09-06  
**Estado**: ✅ Todos los endpoints funcionando correctamente