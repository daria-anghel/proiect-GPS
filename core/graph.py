import json


class Graph:
    def __init__(self, filepath):
        """
        Clasa Graph gestionează nodurile și legăturile dintre ele.
        :param filepath: calea către fișierul JSON care conține harta.
        """
        try:
            with open(filepath, "r", encoding="utf-8") as file:
                self.data = json.load(file)
        except FileNotFoundError:
            print(f" Fișierul {filepath} nu a fost găsit.")
            self.data = {}
        except json.JSONDecodeError:
            print(
                f" Eroare la citirea fișierului {filepath} — format JSON invalid.")
            self.data = {}

    def nodes(self):
        """
        Returnează toate nodurile (locațiile/intersecțiile) din hartă.
        """
        return list(self.data.keys())

    def neighbors(self, node):
        """
        Returnează vecinii unui nod dat.
        :param node: ID-ul nodului (string)
        :return: un dicționar {vecin: distanță}
        """
        return self.data.get(str(node), {})

    def display(self, limit=10):
        """
        Afișează câteva conexiuni din hartă pentru testare (maxim `limit` noduri).
        """
        print("=== Harta Brașov (fragment) ===")
        count = 0
        for node, neighbors in self.data.items():
            print(f"\n{node}:")
            for neighbor, distance in neighbors.items():
                print(f"   -> {neighbor} ({round(distance, 1)} m)")
            count += 1
            if count >= limit:
                break
