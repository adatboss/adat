
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE sessions (
    sid char(32) NOT NULL,
    uid uuid,
    created timestamp with time zone
);
ALTER TABLE ONLY sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE sessions;

