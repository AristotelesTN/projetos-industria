---
name: checklist-gaps
description: Rankings e gaps no checklist mock de 50 empresas.
---

# Checklist — 50 empresas

Ranking de cobertura:

```sql
SELECT * FROM cobertura_por_empresa LIMIT 10;
```

Por setor:

```sql
SELECT * FROM cobertura_por_setor;
```

Gaps (Não tem) no pilar 6 para empresas líderes:

```sql
SELECT empresa_nome, item_id, texto, cobertura
FROM avaliacoes
WHERE maturidade_ia = 'líder'
  AND pilar = 6
  AND cobertura = 'Não tem'
ORDER BY empresa_nome, item_id;
```

Decisões Construir vs Comprar:

```sql
SELECT decisao, COUNT(*) AS n
FROM avaliacoes
WHERE CAST(pilar AS VARCHAR) != 'sintese'
  AND decisao IN ('Comprar', 'Construir', 'Híbrido')
GROUP BY 1
ORDER BY n DESC;
```
