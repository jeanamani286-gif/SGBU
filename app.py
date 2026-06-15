# Application Flask du projet SGBU
# Systeme de Gestion de Bibliotheque Universitaire
#
# Ce fichier ne fait que 3 choses :
#   1. Creer l'application Flask
#   2. Ajouter les deux groupes de routes (etudiant et bibliothecaire)
#   3. Lancer le serveur

import flask

import routes_etudiant
import routes_admin

app = flask.Flask(__name__)
app.secret_key = "ma_cle_secrete_sgbu"

# On attache les groupes de routes a l'application
app.register_blueprint(routes_etudiant.bp)
app.register_blueprint(routes_admin.bp)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
