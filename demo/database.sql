
CREATE TABLE users
(
  id serial NOT NULL,
  username character varying(64),
  password character varying(255),
  CONSTRAINT userspk PRIMARY KEY (id)
);

CREATE TABLE categories
(
  id serial NOT NULL,
  title character varying(120),
  CONSTRAINT categoriespk PRIMARY KEY (id)
);

CREATE TABLE posts
(
  id serial NOT NULL,
  users_id bigint,
  title character varying(120),
  categories_id bigint,
  publish boolean,
  CONSTRAINT postspk PRIMARY KEY (id),
  CONSTRAINT postscategoriesfk FOREIGN KEY (categories_id)
      REFERENCES categories (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT postsusersfk FOREIGN KEY (users_id)
      REFERENCES users (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);

INSERT INTO users (username, password) VALUES ('john', '123');
INSERT INTO users (username, password) VALUES ('lia', '123');

INSERT INTO categories (title) VALUES ('Cinema');
INSERT INTO categories (title) VALUES ('Media');

INSERT INTO posts (title, users_id, categories_id, publish) VALUES ('First post', 1, 1, true);
INSERT INTO posts (title, users_id, categories_id, publish) VALUES ('Second post', 1, 2, true);
INSERT INTO posts (title, users_id, categories_id, publish) VALUES ('Third post', 2, 1, true);
INSERT INTO posts (title, users_id, categories_id, publish) VALUES ('Forth post', 2, 2, false);
