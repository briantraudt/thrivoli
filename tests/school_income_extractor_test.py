"""Synthetic workbooks only; uses the existing local spreadsheet runtime."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import openpyxl

spec = importlib.util.spec_from_file_location("extractor", Path(__file__).parents[1] / "scripts/extract-school-income.py")
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)


class ExtractorTest(unittest.TestCase):
    def fixture(self):
        w = openpyxl.Workbook()
        s = w.active
        s.title = "2026"
        for c, name in zip(range(3, 24, 2), ["Jan", "Feb", "March", "April", "May", "June", "July/Aug", "Sep", "Oct", "Nov", "Dec"]):
            s.cell(3, c, name)
        s["A4"] = "Fictional Academy"
        s["A5"] = "Fictional Academy"
        s["B4"] = 2
        s["C4"] = 10.25
        s["C5"] = 0
        s["E4"] = "-"
        s["G4"] = "#VALUE!"
        return w

    def extract(self, w):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / "Fictional source.xlsx"
            w.save(p)
            return extractor.extract(p, "libfile_fictional", 0)

    def test_preserves_states_and_duplicate_rows(self):
        s = self.extract(self.fixture())["sheets"][0]
        self.assertEqual(len(s["rows"]), 2)
        self.assertEqual(s["numericCells"], 2)
        self.assertEqual(s["rawHundredths"], "1025")
        self.assertEqual(s["rows"][1]["values"][0]["income"]["value"], "0")
        self.assertEqual(s["rows"][0]["values"][1]["income"]["state"], "dash")
        self.assertEqual(s["rows"][0]["values"][2]["income"]["state"], "error")
        self.assertEqual(s["rows"][1]["values"][1]["income"]["state"], "blank")
        self.assertEqual(s["periods"][6]["end"], 8)

    def test_rejects_unsupported_or_sensitive_inputs(self):
        def hidden(w): w.active.row_dimensions[4].hidden = True
        def header(w): w.active["O3"] = "July"
        def unknown(w): w.active["X4"] = 2
        def precise(w): w.active["C4"] = 1.001
        def sensitive(w): w.active["A4"] = "Student ID"
        def formula(w): w.active["C4"] = "=1+1"
        def unlabeled(w): w.active["A4"] = None
        for mutate in [hidden, header, unknown, precise, sensitive, formula, unlabeled]:
            w = self.fixture()
            mutate(w)
            with self.assertRaises(ValueError):
                self.extract(w)


if __name__ == "__main__":
    unittest.main()
