
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE widgets (
	id uuid PRIMARY KEY,
	type text NOT NULL,
	dashboard uuid REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL,
	created timestamp with time zone NOT NULL,
	config text NOT NULL
);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE widgets;
