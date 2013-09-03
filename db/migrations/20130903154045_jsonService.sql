
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE json_services (
	id uuid PRIMARY KEY,
	url text NOT NULL,
	config text NOT NULL
);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE json_services;
