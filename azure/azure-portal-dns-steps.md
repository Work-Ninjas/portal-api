# 🌐 Configuración DNS desde Azure Portal - Paso a Paso

## 🎯 Objetivo
Configurar los dominios personalizados `api.datahubportal.com` y `docs.datahubportal.com` directamente desde Azure Portal.

---

## 📋 PASO 1: Crear DNS Zone en Azure

### 1.1 Crear Azure DNS Zone
1. **Ir al Azure Portal**: https://portal.azure.com
2. **Buscar "DNS zones"** en la barra de búsqueda
3. **Clic en "+ Create"**
4. **Configurar**:
   - **Subscription**: Tu suscripción actual
   - **Resource group**: `rg-data-migration-portal-prod`
   - **Name**: `datahubportal.com`
   - **Location**: `Global`
5. **Clic "Review + Create"** → **"Create"**

### 1.2 Obtener Name Servers
1. **Una vez creada**, ir a la DNS zone `datahubportal.com`
2. **Copiar los 4 Name Servers** que aparecen (algo como):
   ```
   ns1-01.azure-dns.com
   ns2-01.azure-dns.net
   ns3-01.azure-dns.org
   ns4-01.azure-dns.info
   ```
3. **⚠️ IMPORTANTE**: Necesitarás configurar estos name servers en tu registrador de dominios (GoDaddy, Namecheap, etc.)

---

## 📋 PASO 2: Crear Registros DNS

### 2.1 Registro CNAME para API
1. **Dentro de la DNS zone `datahubportal.com`**
2. **Clic "+ Record set"**
3. **Configurar**:
   - **Name**: `api`
   - **Type**: `CNAME`
   - **TTL**: `3600`
   - **Alias**: `api-datahubportal-e0hmc5h9acb9a5cu.z01.azurefd.net`
4. **Clic "OK"**

### 2.2 Registro TXT para validación Front Door
1. **Clic "+ Record set"**
2. **Configurar**:
   - **Name**: `_dnsauth.api`
   - **Type**: `TXT`  
   - **TTL**: `3600`
   - **Value**: `_e61jihcso0s80l8c1y9byzxr26brtzb`
3. **Clic "OK"**

### 2.3 Registro CNAME para Docs
1. **Clic "+ Record set"**
2. **Configurar**:
   - **Name**: `docs`
   - **Type**: `CNAME`
   - **TTL**: `3600`
   - **Alias**: `gentle-mud-0c449720f.2.azurestaticapps.net`
3. **Clic "OK"**

---

## 📋 PASO 3: Configurar Name Servers en Registrador

### 3.1 Actualizar Name Servers
1. **Ir a tu registrador de dominios** (donde compraste datahubportal.com)
2. **Buscar "DNS Management" o "Name Servers"**
3. **Cambiar a "Custom Name Servers"**
4. **Introducir los 4 name servers de Azure**:
   ```
   ns1-01.azure-dns.com
   ns2-01.azure-dns.net  
   ns3-01.azure-dns.org
   ns4-01.azure-dns.info
   ```
5. **Guardar cambios**

⚠️ **Tiempo de propagación**: 15 minutos - 24 horas

---

## 📋 PASO 4: Verificar Front Door Domain Validation

### 4.1 Verificar validación
1. **Ir a Azure Portal** → **CDN profiles**
2. **Seleccionar `portal-api-frontdoor`**
3. **Ir a "Custom domains"**
4. **Verificar que `api-datahubportal-com` muestre**:
   - **Domain validation state**: `Approved` ✅
   - **Certificate state**: `CertificateDeployed` ✅

### 4.2 Si está pendiente
- **Esperar 15-30 minutos** después de configurar DNS
- **Refresh la página** del portal
- El certificado TLS se creará automáticamente

---

## 📋 PASO 5: Configurar Static Web Apps Domain

### 5.1 Agregar custom domain
1. **Ir a Azure Portal** → **Static Web Apps**  
2. **Seleccionar `portal-docs-prod`**
3. **Ir a "Custom domains"**
4. **Clic "+ Add"**
5. **Configurar**:
   - **Domain name**: `docs.datahubportal.com`
   - **Hostname record type**: `CNAME`
6. **Clic "Add"**

### 5.2 Verificar certificado
- El certificado TLS se creará automáticamente
- **Estado objetivo**: `Ready` ✅

---

## 📋 PASO 6: Verificación Final

### 6.1 Verificar URLs
1. **Abrir en navegador**:
   - https://api.datahubportal.com → Debe mostrar "Your Azure Container Apps app is live"
   - https://docs.datahubportal.com → Debe mostrar página de Static Web App

### 6.2 Verificar certificados TLS
1. **Hacer clic en el candado 🔒** en ambas URLs
2. **Verificar**:
   - Certificado válido ✅
   - Emitido por Microsoft ✅
   - Fecha de expiración futura ✅

---

## 🔧 TROUBLESHOOTING

### Si DNS no resuelve:
1. **Verificar name servers** están configurados correctamente
2. **Esperar más tiempo** (hasta 24h para propagación completa)
3. **Usar herramientas**:
   - https://www.whatsmydns.net/
   - `nslookup api.datahubportal.com`

### Si Front Door validation falla:
1. **Verificar registro TXT** `_dnsauth.api`
2. **Re-crear el custom domain** en Front Door
3. **Contactar soporte Azure** si persiste

### Si Static Web App falla:
1. **Verificar CNAME docs** apunta correctamente
2. **Eliminar y re-agregar** el custom domain
3. **Verificar que DNS zone** esté activa

---

## 📊 COMANDOS DE VERIFICACIÓN (Opcional)

Si tienes Azure CLI local, puedes verificar con:

```bash
# Verificar Front Door domain
az afd custom-domain show \
  --resource-group "rg-data-migration-portal-prod" \
  --profile-name "portal-api-frontdoor" \
  --custom-domain-name "api-datahubportal-com"

# Verificar Static Web App domains  
az staticwebapp hostname list \
  --name "portal-docs-prod" \
  --resource-group "rg-data-migration-portal-prod"
```

---

## 🎯 RESULTADO ESPERADO

### ✅ URLs Finales Funcionando:
- **https://api.datahubportal.com** - Azure Container Apps via Front Door
- **https://docs.datahubportal.com** - Azure Static Web Apps

### ✅ Características:
- 🔒 **TLS Certificates**: Managed by Azure, auto-renewal
- 🌐 **Global CDN**: Front Door for API, Static Web Apps CDN for docs  
- 📊 **Monitoring**: Application Insights collecting telemetry
- 🚨 **Alerts**: Basic monitoring active

---

## ⏱️ TIEMPO ESTIMADO TOTAL

- **DNS Zone Creation**: 5 minutos
- **Record Configuration**: 10 minutos  
- **Name Server Update**: 5 minutos
- **Propagation Wait**: 30 minutos - 2 horas
- **Domain Validation**: 15 minutos
- **Final Verification**: 5 minutos

**Total**: **1-3 horas** dependiendo de propagación DNS

---

**🚀 Una vez completado, tendrás el cutover completo de Portal API funcionando en api.datahubportal.com y docs.datahubportal.com con certificados TLS automáticos!**