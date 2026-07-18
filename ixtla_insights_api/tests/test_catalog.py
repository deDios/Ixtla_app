import unittest

from app.catalog import CATALOG
from app.schemas import ChatRequest, Scope
from app.services import heuristic_response


class InsightsCatalogTests(unittest.TestCase):
    def test_catalog_has_only_supported_widget_kinds(self):
        self.assertEqual(CATALOG["widget_kinds"], ["kpi", "bar", "donut", "line", "area", "table", "funnel"])

    def test_heuristic_returns_a_donut_preview(self):
        response = heuristic_response(ChatRequest(
            question="Grafica de pastel por estatus",
            scope=Scope(domain="requerimientos"),
        ))
        self.assertEqual(response.actions[0].widget.kind, "donut")
        self.assertEqual(response.actions[0].widget.dimension, "estatus")
