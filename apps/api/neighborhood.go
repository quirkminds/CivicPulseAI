package main

import (
	"errors"
	"net/http"
	"regexp"

	"civicpulse/api/store"
)

var neighborhoodParent = regexp.MustCompile(`^(community-[0-9]{2}|province-[0-9]{2}|municipality-[0-9]{5}|district-[0-9]{7})$`)

func (a *api) handleNeighborhood(w http.ResponseWriter, r *http.Request) {
	var parent *string
	if value := r.URL.Query().Get("parent"); value != "" {
		if !neighborhoodParent.MatchString(value) {
			writeProblem(w, r, http.StatusBadRequest, "invalid-zone", "El identificador de la zona no es válido.")
			return
		}
		parent = &value
	}

	data, err := a.store.Neighborhood(r.Context(), parent)
	switch {
	case errors.Is(err, store.ErrNeighborhoodNotFound):
		writeProblem(w, r, http.StatusNotFound, "zone-not-found", "No hay subdivisiones para esta zona.")
	case errors.Is(err, store.ErrNeighborhoodUnavailable):
		writeProblem(w, r, http.StatusServiceUnavailable, "neighborhood-not-imported", "El Atlas del INE todavía no está cargado.")
	case err != nil:
		a.logger.ErrorContext(r.Context(), "neighborhood query failed", "err", err)
		writeProblem(w, r, http.StatusServiceUnavailable, "neighborhood-unavailable", "No se pudieron consultar los datos del INE.")
	default:
		writeJSON(w, http.StatusOK, data)
	}
}
