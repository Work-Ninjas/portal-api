#!/bin/bash

# Script para verificar el estado de configuración DNS
# Portal API - Azure Custom Domains

echo "🔍 VERIFICACIÓN DNS - Portal API"
echo "================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_dns_record() {
    local domain=$1
    local type=$2
    local expected=$3
    local description=$4
    
    echo "🔍 Verificando ${description}..."
    echo "   Dominio: ${domain}"
    echo "   Tipo: ${type}"
    echo "   Esperado: ${expected}"
    
    if command -v nslookup >/dev/null 2>&1; then
        if [[ "${type}" == "CNAME" ]]; then
            result=$(nslookup "${domain}" 2>/dev/null | grep -A1 "Non-authoritative answer:" | tail -1 | awk '{print $2}' | sed 's/\.$//g')
        else
            result=$(nslookup -type=TXT "${domain}" 2>/dev/null | grep "text =" | sed 's/.*text = "\(.*\)".*/\1/')
        fi
        
        if [[ "${result}" == "${expected}" ]]; then
            echo -e "   ${GREEN}✅ CORRECTO${NC}: ${result}"
        elif [[ -z "${result}" ]]; then
            echo -e "   ${RED}❌ NO ENCONTRADO${NC}: El registro no existe o no ha propagado"
        else
            echo -e "   ${YELLOW}⚠️  INCORRECTO${NC}: ${result}"
            echo "      Esperado: ${expected}"
        fi
    else
        echo -e "   ${YELLOW}⚠️  NSLOOKUP NO DISPONIBLE${NC}"
    fi
    echo ""
}

# Verificar registros DNS
echo "📍 Verificando registros DNS para datahubportal.com..."
echo ""

check_dns_record "api.datahubportal.com" "CNAME" "api-datahubportal-e0hmc5h9acb9a5cu.z01.azurefd.net" "API CNAME"
check_dns_record "_dnsauth.api.datahubportal.com" "TXT" "_e61jihcso0s80l8c1y9byzxr26brtzb" "API Validation TXT"
check_dns_record "docs.datahubportal.com" "CNAME" "gentle-mud-0c449720f.2.azurestaticapps.net" "Docs CNAME"

# Verificar estado Azure Front Door
echo "☁️ Verificando estado en Azure..."
echo ""

if command -v az >/dev/null 2>&1; then
    echo "🔍 Estado del dominio personalizado en Front Door..."
    validation_state=$(az afd custom-domain show \
        --resource-group "rg-data-migration-portal-prod" \
        --profile-name "portal-api-frontdoor" \
        --custom-domain-name "api-datahubportal-com" \
        --query "domainValidationState" -o tsv 2>/dev/null)
    
    if [[ "${validation_state}" == "Approved" ]]; then
        echo -e "   ${GREEN}✅ DOMINIO VALIDADO${NC}"
    elif [[ "${validation_state}" == "Pending" ]]; then
        echo -e "   ${YELLOW}⏳ VALIDACIÓN PENDIENTE${NC}"
        echo "      Esperando propagación DNS..."
    else
        echo -e "   ${RED}❌ ESTADO: ${validation_state}${NC}"
    fi
    
    echo ""
    echo "🔍 Estado del certificado..."
    cert_state=$(az afd custom-domain show \
        --resource-group "rg-data-migration-portal-prod" \
        --profile-name "portal-api-frontdoor" \
        --custom-domain-name "api-datahubportal-com" \
        --query "tlsSettings.certificateState" -o tsv 2>/dev/null)
    
    if [[ "${cert_state}" == "CertificateDeployed" ]]; then
        echo -e "   ${GREEN}✅ CERTIFICADO DESPLEGADO${NC}"
    elif [[ "${cert_state}" == "CertificateDeploymentInProgress" ]]; then
        echo -e "   ${YELLOW}⏳ DESPLEGANDO CERTIFICADO${NC}"
    else
        echo -e "   ${YELLOW}⏳ ESTADO: ${cert_state}${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  Azure CLI no disponible${NC}"
fi

echo ""

# Test de conectividad HTTP
echo "🌐 Verificando conectividad HTTP..."
echo ""

test_http() {
    local url=$1
    local description=$2
    
    echo "🔗 Probando ${description}: ${url}"
    
    if command -v curl >/dev/null 2>&1; then
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}" 2>/dev/null)
        
        if [[ "${http_code}" == "200" ]]; then
            echo -e "   ${GREEN}✅ ÉXITO${NC}: HTTP ${http_code}"
        elif [[ "${http_code}" == "000" ]]; then
            echo -e "   ${RED}❌ ERROR${NC}: No se pudo conectar (DNS no resuelve)"
        else
            echo -e "   ${YELLOW}⚠️  HTTP ${http_code}${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠️  CURL no disponible${NC}"
    fi
    echo ""
}

# Test URLs actuales (deben funcionar)
test_http "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/" "Container App"
test_http "https://gentle-mud-0c449720f.2.azurestaticapps.net/" "Static Web App"

# Test URLs objetivo (pueden fallar hasta que DNS propague)
test_http "https://api.datahubportal.com/" "API Custom Domain"
test_http "https://docs.datahubportal.com/" "Docs Custom Domain"

# Resumen y próximos pasos
echo "📋 RESUMEN"
echo "=========="
echo ""
echo "🎯 PRÓXIMOS PASOS:"
echo ""
echo "1. Si DNS NO está configurado:"
echo "   - Configurar registros DNS según dns-configuration-instructions.md"
echo "   - Esperar 15-30 minutos para propagación"
echo ""
echo "2. Si DNS está configurado pero validación pendiente:"
echo "   - Esperar hasta 1 hora para validación automática"
echo "   - Re-ejecutar este script para verificar"
echo ""
echo "3. Una vez validado el Front Door:"
echo "   - Configurar Static Web App hostname:"
echo "     az staticwebapp hostname set --resource-group \"rg-data-migration-portal-prod\" --name \"portal-docs-prod\" --hostname \"docs.datahubportal.com\""
echo ""
echo "4. Verificación final:"
echo "   - https://api.datahubportal.com/ debe mostrar la API"
echo "   - https://docs.datahubportal.com/ debe mostrar documentación"
echo "   - Certificados TLS activos en ambos dominios"
echo ""
echo "🔄 Ejecutar este script periódicamente para monitorear progreso."
echo ""
echo "⏰ Última verificación: $(date)"