package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.LocalDateTime;
import java.util.Objects;

/** Parent of every entity saved in the database: holds the id and the creation time. */
public abstract class BaseEntity {

    private Integer id;                 // null until saved
    private LocalDateTime createdAt;

    /** "New" constructor: the object is not saved yet, so it has no id. */
    protected BaseEntity() {
    }

    /** "From database" constructor, used by the DAOs' RowMappers. */
    protected BaseEntity(int id, LocalDateTime createdAt) {
        this.id = id;
        this.createdAt = createdAt;
    }

    public Integer getId() { return id; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    /** True if this object hasn't been saved yet. */
    @JsonIgnore
    public boolean isNew() {
        return id == null;
    }

    /** Called once by the DAO after INSERT, with the generated id. */
    public void assignId(int id) {
        if (this.id != null) {
            throw new IllegalStateException("This " + getClass().getSimpleName() + " already has an id.");
        }
        this.id = id;
    }

    /** Two entities are equal when they are the same class and have the same (non-null) id. */
    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        BaseEntity other = (BaseEntity) o;
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
