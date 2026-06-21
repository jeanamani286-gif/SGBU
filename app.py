import flask

import routes_etudiant
import routes_admin

app = flask.Flask(__name__)
app.secret_key = "ma_cle_secrete_sgbu"

app.register_blueprint(routes_etudiant.bp)
app.register_blueprint(routes_admin.bp)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
