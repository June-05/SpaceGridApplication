package com.techhub.spacegridapplication.dao;

import java.util.Optional;

/** Basic database operations shared by every DAO. */
public interface CrudDao<T> {

    Optional<T> findById(int id);

    /** INSERT, then call entity.assignId(generatedId). Returns the same entity. */
    T save(T entity);

    void update(T entity);

    void deleteById(int id);
}
