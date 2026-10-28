package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.FileKind;
import com.techhub.spacegridapplication.model.StoredFile;

import java.util.List;

public interface StoredFileDao extends CrudDao<StoredFile> {

    /** Files of one kind that belong to one owner (a property, unit or lease id, matching the kind), oldest first. */
    List<StoredFile> findByOwner(FileKind kind, int ownerId);
}
