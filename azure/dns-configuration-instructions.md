# Instrucciones de Configuración DNS - Portal API

## 🎯 Objetivo
Configurar dominios personalizados para la infraestructura Azure desplegada:
- `api.datahubportal.com` → Azure Front Door
- `docs.datahubportal.com` → Azure Static Web Apps

## 📋 Registros DNS Requeridos

### 1. Para api.datahubportal.com (Azure Front Door)

#### Registro CNAME Principal
```
Tipo: CNAME
Nombre: api
Valor: api-datahubportal-e0hmc5h9acb9a5cu.z01.azurefd.net
TTL: 3600 (o el mínimo de tu proveedor DNS)
```

#### Registro TXT de Validación
```
Tipo: TXT
Nombre: _dnsauth.api
Valor: _e61jihcso0s80l8c1y9byzxr26brtzb
TTL: 3600
```
⚠️ **Importante**: Este registro TXT es temporal y se usa solo para validar el dominio. Puede eliminarse después de la validación.

### 2. Para docs.datahubportal.com (Azure Static Web Apps)

#### Registro CNAME Principal
```
Tipo: CNAME
Nombre: docs
Valor: gentle-mud-0c449720f.2.azurestaticapps.net
TTL: 3600
```

## 🛠️ Proveedores DNS Comunes

### Cloudflare
1. Ir a DNS → Records
2. Hacer clic en "Add record"
3. Ingresar los datos según la tabla arriba
4. Hacer clic en "Save"

### Route 53 (AWS)
1. Ir a Route 53 → Hosted zones
2. Seleccionar datahubportal.com
3. Crear record sets con los datos arriba

### GoDaddy
1. Ir a DNS Management
2. Agregar records según la tabla

### Otros Proveedores
- Usar la interfaz web de tu proveedor DNS
- Crear registros CNAME y TXT según las especificaciones arriba

## 🔍 Verificación de DNS

### Comandos para verificar propagación:

```bash
# Verificar CNAME de API
nslookup api.datahubportal.com

# Verificar TXT de validación
nslookup -type=TXT _dnsauth.api.datahubportal.com

# Verificar CNAME de docs
nslookup docs.datahubportal.com
```

### Herramientas Online
- https://www.whatsmydns.net/
- https://dnschecker.org/
- https://www.digwebinterface.com/

## ⏱️ Tiempos de Propagación
- **Típico**: 15-30 minutos
- **Máximo**: 24-48 horas (raro)
- **Recomendación**: Esperar al menos 15 minutos antes de continuar

## 🚀 Después de Configurar DNS

Una vez que los registros DNS estén propagados:

### 1. Verificar validación de dominio Front Door
```bash
az afd custom-domain show \
  --resource-group "rg-data-migration-portal-prod" \
  --profile-name "portal-api-frontdoor" \
  --custom-domain-name "api-datahubportal-com" \
  --query "domainValidationState"
```

### 2. Configurar dominio en Static Web App
```bash
az staticwebapp hostname set \
  --resource-group "rg-data-migration-portal-prod" \
  --name "portal-docs-prod" \
  --hostname "docs.datahubportal.com"
```

### 3. Verificar certificados TLS
Los certificados managed de Azure se crearán automáticamente después de la validación.

## 🎯 URLs Finales

Una vez completada la configuración:
- **API Production**: https://api.datahubportal.com
- **Documentation**: https://docs.datahubportal.com

## 📞 Soporte

Si encuentras problemas:
1. Verificar que DNS esté propagado globalmente
2. Confirmar que los valores TXT/CNAME son exactos
3. Esperar tiempo adicional para propagación
4. Revisar logs en Azure Portal

---

**Fecha de creación**: $(date)  
**Validación expira**: 2025-09-09T19:42:13 UTC  
**Token de validación**: _e61jihcso0s80l8c1y9byzxr26brtzb