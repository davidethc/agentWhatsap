#!/usr/bin/env python3
"""Revisión local de un WhatsApp Flow JSON antes de pegarlo en Kapso o Meta.

Uso: scripts/check-flow.py flows/<archivo>.flow.json

No reemplaza la validación de Meta (el editor de Kapso la hace al guardar), pero
atrapa los errores más comunes: propiedades desconocidas, referencias a campos o
pantallas que no existen, pantallas sin salida, límites por pantalla y largo de textos.
"""
import json
import re
import sys

ALLOWED = {
    "TextHeading": {"type", "text", "visible"},
    "TextSubheading": {"type", "text", "visible"},
    "TextBody": {"type", "text", "visible", "font-weight", "strikethrough", "markdown"},
    "TextCaption": {"type", "text", "visible", "font-weight", "strikethrough", "markdown"},
    "TextInput": {"type", "name", "label", "input-type", "required", "min-chars", "max-chars",
                  "helper-text", "visible", "enabled", "pattern", "init-value", "error-message"},
    "TextArea": {"type", "name", "label", "required", "max-length", "helper-text", "visible",
                 "enabled", "init-value", "error-message"},
    "RadioButtonsGroup": {"type", "name", "label", "data-source", "required", "visible", "enabled",
                          "description", "on-select-action", "init-value", "error-message", "media-size"},
    "CheckboxGroup": {"type", "name", "label", "data-source", "required", "visible", "enabled",
                      "description", "min-selected-items", "max-selected-items", "on-select-action",
                      "init-value", "error-message", "media-size"},
    "Dropdown": {"type", "name", "label", "data-source", "required", "visible", "enabled",
                 "on-select-action", "init-value", "error-message"},
    "DatePicker": {"type", "name", "label", "min-date", "max-date", "unavailable-dates", "visible",
                   "helper-text", "enabled", "on-select-action", "init-value", "error-message"},
    "OptIn": {"type", "name", "label", "required", "visible", "on-click-action", "init-value"},
    "Footer": {"type", "label", "on-click-action", "enabled", "left-caption", "center-caption",
               "right-caption"},
}
MAX_PER_SCREEN = {"Footer": 1, "OptIn": 5, "EmbeddedLink": 2, "Image": 3}
# Máximo de caracteres por componente y propiedad. Fuente: referencia oficial de Meta,
# "WhatsApp Flows > Reference > Components", tablas "Limits and restrictions"
# (developers.facebook.com/documentation/business-messaging/whatsapp/flows/reference/components).
# "option.<prop>" aplica a cada elemento de data-source. Meta no publica límite para el
# title de la pantalla, por eso no se revisa aquí.
LIMITS = {
    "TextHeading": {"text": 80},
    "TextSubheading": {"text": 80},
    "TextBody": {"text": 4096},
    "TextCaption": {"text": 409},
    "TextInput": {"label": 20, "helper-text": 80, "error-message": 30},
    "TextArea": {"label": 20, "helper-text": 80},
    "RadioButtonsGroup": {"label": 30, "option.title": 30, "option.description": 300,
                          "option.metadata": 20},
    "CheckboxGroup": {"label": 30, "option.title": 30, "option.description": 300,
                      "option.metadata": 20},
    "Dropdown": {"label": 20, "option.title": 30, "option.description": 300,
                 "option.metadata": 20},
    "DatePicker": {"label": 40, "helper-text": 80, "error-message": 80},
    "OptIn": {"label": 120},
    "Footer": {"label": 35, "left-caption": 15, "center-caption": 15, "right-caption": 15},
}
INPUTS = {"TextInput", "TextArea", "RadioButtonsGroup", "CheckboxGroup", "Dropdown", "DatePicker", "OptIn"}

errors = []
flow = json.load(open(sys.argv[1]))
screens = {s["id"]: s for s in flow["screens"]}
fields = {sid: {c["name"] for c in s["layout"]["children"] if c.get("type") in INPUTS}
          for sid, s in screens.items()}

for sid, s in screens.items():
    if not re.fullmatch(r"[A-Z][A-Z_]*", sid) or sid == "SUCCESS":
        errors.append(f"{sid}: id inválido")
    children = s["layout"]["children"]
    counts = {}
    for c in children:
        t = c.get("type")
        counts[t] = counts.get(t, 0) + 1
        if t not in ALLOWED:
            errors.append(f"{sid}: componente no revisado por este script: {t}")
            continue
        extra = set(c) - ALLOWED[t]
        if extra:
            errors.append(f"{sid}/{c.get('name', t)}: propiedades no permitidas {sorted(extra)}")
        for ds in c.get("data-source", []) if isinstance(c.get("data-source"), list) else []:
            if set(ds) - {"id", "title", "description", "metadata", "enabled", "image", "alt-text"}:
                errors.append(f"{sid}/{c['name']}: opción con propiedades no permitidas {ds}")
        for prop, limit in LIMITS.get(t, {}).items():
            if prop.startswith("option."):
                opts = c.get("data-source") if isinstance(c.get("data-source"), list) else []
                values = [(f"opción {o.get('id')}.{prop[7:]}", o.get(prop[7:])) for o in opts]
            else:
                values = [(prop, c.get(prop))]
            for where, value in values:
                # Los textos dinámicos ("${data.x}") se miden en tiempo de ejecución, no aquí.
                if isinstance(value, str) and "${" not in value and len(value) > limit:
                    errors.append(f"{sid}/{c.get('name', t)}: {where} tiene {len(value)} "
                                  f"caracteres, máximo {limit}: «{value}»")
        text = json.dumps(c, ensure_ascii=False)
        for key in re.findall(r"\$\{data\.([a-z_]+)\}", text):
            if key not in s.get("data", {}):
                errors.append(f"{sid}: usa ${{data.{key}}} pero la pantalla no lo declara en data")
        for key in re.findall(r"\$\{form\.([a-z_]+)\}", text):
            if key not in fields[sid]:
                errors.append(f"{sid}: usa ${{form.{key}}} pero no hay un campo con ese nombre")
        for other, key in re.findall(r"\$\{screen\.([A-Z_]+)\.form\.([a-z_]+)\}", text):
            if other not in screens or key not in fields[other]:
                errors.append(f"{sid}: referencia a {other}.form.{key} que no existe")
        action = c.get("on-click-action")
        if action and action["name"] == "navigate":
            target = action["next"]["name"]
            if target not in screens:
                errors.append(f"{sid}: navega a {target}, que no existe")
            else:
                need = set(screens[target].get("data", {}))
                missing = need - set(action.get("payload", {}))
                if missing:
                    errors.append(f"{sid} → {target}: faltan en payload {sorted(missing)}")
    for t, limit in MAX_PER_SCREEN.items():
        if counts.get(t, 0) > limit:
            errors.append(f"{sid}: {counts[t]} {t}, máximo {limit}")
    if counts.get("Footer", 0) != 1:
        errors.append(f"{sid}: debe tener exactamente un Footer")
    footer = next((c for c in children if c.get("type") == "Footer"), {})
    is_complete = footer.get("on-click-action", {}).get("name") == "complete"
    if s.get("terminal") and not is_complete:
        errors.append(f"{sid}: pantalla terminal sin acción complete")
    if is_complete and not s.get("terminal"):
        errors.append(f"{sid}: usa complete pero no es terminal")
    for key, spec in s.get("data", {}).items():
        if "__example__" not in spec:
            errors.append(f"{sid}: data.{key} sin __example__")

if errors:
    print("ERRORES:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"OK: {len(screens)} pantallas, {sum(len(f) for f in fields.values())} campos, versión {flow['version']}")
