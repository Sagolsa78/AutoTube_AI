import json

from fastapi.routing import APIRoute

from backend.main import app

routes = []
for route in app.routes:
    if isinstance(route, APIRoute):
        routes.append(
            {"path": route.path, "name": route.name, "methods": list(route.methods)}
        )

print(json.dumps(routes, indent=2))
